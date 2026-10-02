// src/services/reseller.service.js
/**
 * Reseller / External API Fallback Service
 *
 * When local campaign inventory is low, this service fetches tasks from
 * an external GPT reseller API (e.g., VBoost.ru, SproutGigs).
 * Fetched tasks are normalized into our internal Campaign shape and cached
 * in the DB with source = 'reseller_*'.
 */
const axios = require('axios');
const Campaign = require('../models/Campaign');
const logger = require('../config/logger');

const RESELLER_ENABLED = process.env.RESELLER_ENABLED === 'true';
const BASE_URL = process.env.RESELLER_API_URL;
const API_KEY = process.env.RESELLER_API_KEY;

/**
 * Normalize a VBoost/SproutGigs offer into our Campaign shape.
 */
const normalizeExternalOffer = (offer, source) => ({
  source,
  externalOfferId: String(offer.id || offer.offer_id),
  externalApiMeta: offer,
  title: offer.title || offer.name || 'External Task',
  description: offer.description || offer.details || '',
  category: mapExternalCategory(offer.category || offer.type),
  targetUrl: offer.url || offer.target_url || '',
  instructions: offer.instructions || offer.requirements || 'Follow the task instructions.',
  proofType: offer.proof_type === 'screenshot' ? 'screenshot' : 'text',
  payoutPerTask: parseFloat(offer.payout || offer.reward || 0),
  totalBudget: parseFloat(offer.budget || offer.total_payout || 0),
  totalLimit: parseInt(offer.slots || offer.quantity || 10),
  completionsCount: parseInt(offer.completions || 0),
  status: 'active', // External tasks bypass moderation
  autoApprove: true,
  targeting: {
    countries: offer.countries || [],
    minLevel: 1,
    maxCompletionsPerUser: 1,
  },
});

/**
 * Map external category strings to our internal enum values.
 * Extend as reseller APIs are integrated.
 */
const mapExternalCategory = (raw = '') => {
  const cat = raw.toLowerCase();
  if (cat.includes('youtube')) return cat.includes('sub') ? 'youtube_subscribe' : 'youtube_like';
  if (cat.includes('instagram')) return cat.includes('follow') ? 'instagram_follow' : 'instagram_like';
  if (cat.includes('tiktok')) return 'tiktok_follow';
  if (cat.includes('telegram')) return 'telegram_join';
  if (cat.includes('twitter') || cat.includes('x.com')) return 'twitter_follow';
  if (cat.includes('facebook')) return 'facebook_like';
  if (cat.includes('app')) return 'app_install_android';
  if (cat.includes('visit') || cat.includes('surf')) return 'site_visit';
  if (cat.includes('review')) return 'google_review';
  return 'custom';
};

/**
 * Fetch tasks from external reseller and upsert into our DB.
 * Called by a cron job when local active campaigns drop below a threshold.
 *
 * @param {number} limit - Max offers to fetch
 * @returns {number} Count of new/updated campaigns
 */
const syncResellerOffers = async (limit = 50) => {
  if (!RESELLER_ENABLED) {
    logger.debug('Reseller sync disabled');
    return 0;
  }

  if (!BASE_URL || !API_KEY) {
    logger.warn('Reseller API not configured (RESELLER_API_URL / RESELLER_API_KEY missing)');
    return 0;
  }

  let offers = [];
  try {
    const { data } = await axios.get(`${BASE_URL}/offers`, {
      params: { limit, status: 'active' },
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 15000,
    });
    offers = data.offers || data.data || data || [];
    logger.info(`Reseller sync: fetched ${offers.length} offers`);
  } catch (err) {
    logger.error(`Reseller API fetch failed: ${err.message}`);
    return 0;
  }

  let synced = 0;
  for (const offer of offers.slice(0, limit)) {
    try {
      const normalized = normalizeExternalOffer(offer, 'reseller_vboost');
      await Campaign.findOneAndUpdate(
        { source: normalized.source, externalOfferId: normalized.externalOfferId },
        { $set: normalized },
        { upsert: true, new: true }
      );
      synced++;
    } catch (err) {
      logger.warn(`Failed to upsert external offer ${offer.id}: ${err.message}`);
    }
  }

  logger.info(`Reseller sync: ${synced} campaigns upserted`);
  return synced;
};

/**
 * Submit a completion to the reseller API (if required).
 */
const submitToReseller = async (campaign, proofData) => {
  if (!RESELLER_ENABLED || campaign.source === 'internal') return null;

  try {
    const { data } = await axios.post(
      `${BASE_URL}/completions`,
      {
        offer_id: campaign.externalOfferId,
        proof: proofData,
      },
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
        timeout: 10000,
      }
    );
    return data;
  } catch (err) {
    logger.error(`Reseller completion submit failed: ${err.message}`);
    return null;
  }
};

module.exports = { syncResellerOffers, submitToReseller };
