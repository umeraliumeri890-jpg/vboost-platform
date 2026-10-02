// src/routes/offers.routes.js
/**
 * Campaign / Offer endpoints.
 * Accessible via JWT (web) or X-API-Key (external integrators).
 *
 * POST   /api/v1/offers              — Create campaign
 * GET    /api/v1/offers              — List campaigns (worker feed / advertiser list)
 * GET    /api/v1/offers/:id          — Get campaign details
 * PATCH  /api/v1/offers/:id          — Update campaign (advertiser)
 * PATCH  /api/v1/offers/:id/pause    — Pause / resume campaign
 * DELETE /api/v1/offers/:id          — Cancel campaign + refund
 */
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const router = express.Router();

const Campaign = require('../models/Campaign');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { AppError, NotFoundError } = require('../utils/errors');
const { protect, apiKeyAuth, flexAuth, restrictTo, requireScope } = require('../middleware/auth');
const { debitBalance } = require('../services/ledger.service');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Validation failed', 422, errors.array()));
  next();
};

const TASK_CATEGORIES = require('../models/Campaign').schema.path('category').enumValues;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/offers — Create Campaign
// Supports both JWT (web advertisers) and API key (external integrations)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  flexAuth,
  requireScope('offers:write'),  // Only checked when apiKey is used
  [
    body('title').trim().isLength({ min: 5, max: 120 }),
    body('description').trim().isLength({ min: 10, max: 2000 }),
    body('category').isIn(TASK_CATEGORIES),
    body('targetUrl').isURL({ require_protocol: true }),
    body('instructions').trim().isLength({ min: 10, max: 5000 }),
    body('proofType').isIn(['screenshot', 'text', 'username', 'url', 'none']),
    body('payoutPerTask').isFloat({ min: 0.01 }),
    body('totalLimit').isInt({ min: 1 }),
    body('webhookUrl').optional().isURL(),
    body('targeting.countries').optional().isArray(),
    body('targeting.minLevel').optional().isInt({ min: 1 }),
    body('targeting.maxCompletionsPerUser').optional().isInt({ min: 1 }),
    body('expiresAt').optional().isISO8601(),
    body('autoApprove').optional().isBoolean(),
    body('autoApproveDelay').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const {
      title, description, category, targetUrl, instructions,
      proofType, proofInstructions, payoutPerTask, totalLimit,
      webhookUrl, webhookSecret, targeting, expiresAt,
      autoApprove, autoApproveDelay,
    } = req.body;

    const advertiser = req.user;

    // Calculate required budget (platform deducts on creation)
    const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 15;
    const grossCostPerTask = parseFloat((payoutPerTask / (1 - feePercent / 100)).toFixed(4));
    const totalBudget = parseFloat((grossCostPerTask * totalLimit).toFixed(4));

    const minBudget = parseFloat(process.env.MIN_CAMPAIGN_BUDGET) || 1.0;
    if (totalBudget < minBudget) {
      throw new AppError(`Minimum campaign budget is $${minBudget}.`, 400);
    }

    // Use a Mongoose session for atomic balance debit + campaign creation
    const session = await mongoose.startSession();
    session.startTransaction();

    let campaign;
    try {
      // Debit advertiser's ad balance
      await debitBalance({
        userId: advertiser._id,
        amount: totalBudget,
        balanceType: 'ad',
        type: 'task_spend',
        note: `Campaign budget lock: ${title}`,
        session,
      });

      campaign = new Campaign({
        advertiser: advertiser._id,
        title,
        description,
        category,
        targetUrl,
        instructions,
        proofType,
        proofInstructions,
        payoutPerTask,
        totalBudget,
        totalLimit,
        platformFeePercent: feePercent,
        webhookUrl,
        webhookSecret,
        targeting: {
          countries: targeting?.countries || [],
          minLevel: targeting?.minLevel || 1,
          maxCompletionsPerUser: targeting?.maxCompletionsPerUser || 1,
        },
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        autoApprove: autoApprove || false,
        autoApproveDelay: autoApproveDelay || 0,
        status: 'pending_review', // Admins activate manually (or auto for trusted advertisers)
      });

      await campaign.save({ session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    // Update advertiser stats (non-critical, outside session)
    await User.findByIdAndUpdate(advertiser._id, {
      $inc: { 'stats.campaignsCreated': 1, 'stats.totalSpent': totalBudget },
    });

    res.status(201).json({
      status: 'success',
      message: 'Campaign created and pending moderation review.',
      data: { campaign },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/offers — List Campaigns
// Worker view: active campaigns | Advertiser view: own campaigns
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  protect,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('category').optional(),
    query('status').optional(),
    query('view').optional().isIn(['worker', 'advertiser']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const view = req.query.view || 'worker';

    let filter = {};

    if (view === 'advertiser') {
      // Advertiser sees their own campaigns regardless of status
      filter.advertiser = req.user._id;
      if (req.query.status) filter.status = req.query.status;
    } else {
      // Workers see active campaigns, filtered by their level
      filter.status = 'active';
      filter['targeting.minLevel'] = { $lte: req.user.gamification.level };
    }

    if (req.query.category) filter.category = req.query.category;

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('advertiser', 'username avatar'),
      Campaign.countDocuments(filter),
    ]);

    res.json({
      status: 'success',
      data: {
        campaigns,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/offers/:id — Get Single Campaign
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id)
    .populate('advertiser', 'username avatar');
  if (!campaign) throw new NotFoundError('Campaign');
  res.json({ status: 'success', data: { campaign } });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/offers/:id — Update Campaign (advertiser only)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/:id',
  flexAuth,
  requireScope('offers:write'),
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) throw new NotFoundError('Campaign');
    if (campaign.advertiser.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden: not your campaign.', 403);
    }
    if (!['draft', 'paused'].includes(campaign.status)) {
      throw new AppError('Only draft or paused campaigns can be edited.', 400);
    }

    const allowed = ['title', 'description', 'instructions', 'proofInstructions',
                     'webhookUrl', 'targeting', 'expiresAt', 'autoApprove'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) campaign[field] = req.body[field];
    });

    await campaign.save();
    res.json({ status: 'success', data: { campaign } });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/offers/:id/pause — Toggle pause/resume
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/pause', protect, asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) throw new NotFoundError('Campaign');
  if (campaign.advertiser.toString() !== req.user._id.toString()) {
    throw new AppError('Forbidden.', 403);
  }

  if (campaign.status === 'active') {
    campaign.status = 'paused';
    campaign.pausedAt = new Date();
  } else if (campaign.status === 'paused') {
    campaign.status = 'active';
    campaign.pausedAt = null;
  } else {
    throw new AppError(`Cannot toggle pause on a ${campaign.status} campaign.`, 400);
  }

  await campaign.save();
  res.json({ status: 'success', data: { campaign } });
}));

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/offers/:id — Cancel campaign + refund remaining budget
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const campaign = await Campaign.findById(req.params.id).session(session);
    if (!campaign) throw new NotFoundError('Campaign');
    if (campaign.advertiser.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden.', 403);
    }
    if (['completed', 'cancelled'].includes(campaign.status)) {
      throw new AppError('Campaign already finalised.', 400);
    }

    const refundAmount = campaign.remainingBudget;
    if (refundAmount > 0) {
      const { creditBalance } = require('../services/ledger.service');
      await creditBalance({
        userId: req.user._id,
        amount: refundAmount,
        balanceType: 'ad',
        type: 'refund',
        refs: { relatedCampaign: campaign._id },
        note: 'Campaign cancellation refund',
        session,
      });
    }

    campaign.status = 'cancelled';
    await campaign.save({ session });
    await session.commitTransaction();

    res.json({
      status: 'success',
      message: `Campaign cancelled. $${refundAmount.toFixed(2)} refunded to ad balance.`,
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}));

module.exports = router;
