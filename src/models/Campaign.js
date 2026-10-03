// src/models/Campaign.js
const mongoose = require('mongoose');

/**
 * Supported task categories and their allowed social networks / task types.
 */
const TASK_CATEGORIES = [
  // Social
  'vk_follow', 'vk_like', 'vk_repost',
  'instagram_follow', 'instagram_like', 'instagram_comment',
  'youtube_subscribe', 'youtube_like', 'youtube_watch',
  'tiktok_follow', 'tiktok_like',
  'telegram_join', 'telegram_view',
  'facebook_like', 'facebook_follow', 'facebook_share',
  'twitter_follow', 'twitter_like', 'twitter_retweet',
  'threads_follow', 'threads_like',
  // Custom
  'app_install_android', 'app_install_ios',
  'site_visit', 'site_signup',
  'google_review', 'yandex_review',
  'custom',
];

const PROOF_TYPES = ['screenshot', 'text', 'username', 'url', 'none'];

const CampaignSchema = new mongoose.Schema(
  {
    // ─── Ownership ──────────────────────────────────────────
    advertiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ─── External API Source ────────────────────────────────
    source: {
      type: String,
      enum: ['internal', 'reseller_vboost', 'reseller_sproutgigs', 'reseller_other'],
      default: 'internal',
      index: true,
    },
    externalOfferId: { type: String, default: null }, // ID from reseller API
    externalApiMeta: { type: mongoose.Schema.Types.Mixed, default: null },

    // ─── Task Definition ────────────────────────────────────
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: TASK_CATEGORIES,
      required: true,
      index: true,
    },
    targetUrl: {
      type: String,
      required: true,
      trim: true,
    },
    instructions: {
      type: String,
      required: true,
      maxlength: 5000,
    },

    // ─── Proof Requirements ─────────────────────────────────
    proofType: {
      type: String,
      enum: PROOF_TYPES,
      required: true,
      default: 'screenshot',
    },
    proofInstructions: { type: String, maxlength: 1000 },

    // ─── Economics ──────────────────────────────────────────
    payoutPerTask: {
      type: Number,
      required: true,
      min: [
        parseFloat(process.env.MIN_PAYOUT_PER_TASK) || 0.001,
        'Minimum payout is $0.001',
      ],
    },
    totalBudget: {
      type: Number,
      required: true,
      min: [parseFloat(process.env.MIN_CAMPAIGN_BUDGET) || 1.0, 'Minimum budget is $1.00'],
    },
    spentBudget: { type: Number, default: 0, min: 0 },
    totalLimit: {
      type: Number,
      required: true,
      min: 1,
    }, // Max number of task completions
    completionsCount: { type: Number, default: 0 },

    // Platform fee snapshot at creation time
    platformFeePercent: {
      type: Number,
      default: parseFloat(process.env.PLATFORM_FEE_PERCENT) || 25,
    },

    // ─── Targeting & Constraints ────────────────────────────
    targeting: {
      countries: [{ type: String }], // ISO 3166-1 alpha-2, empty = all
      minLevel: { type: Number, default: 1 },
      maxCompletionsPerUser: { type: Number, default: 1 },
    },

    // ─── Moderation ─────────────────────────────────────────
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'active', 'paused', 'completed', 'rejected', 'cancelled'],
      default: 'pending_review',
      index: true,
    },
    moderationNote: { type: String, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },

    // ─── Webhook (advertiser's callback) ───────────────────
    webhookUrl: { type: String, default: null },
    webhookSecret: { type: String, select: false }, // HMAC secret for callback sig

    // ─── Auto-verification ──────────────────────────────────
    autoApprove: { type: Boolean, default: false },
    autoApproveDelay: { type: Number, default: 0 }, // seconds after submission

    expiresAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
CampaignSchema.index({ status: 1, category: 1 });
CampaignSchema.index({ advertiser: 1, status: 1 });
CampaignSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
CampaignSchema.index({ createdAt: -1 });

// ─── Virtual: remaining slots ─────────────────────────────────────────────────
CampaignSchema.virtual('remainingSlots').get(function () {
  return Math.max(0, this.totalLimit - this.completionsCount);
});

// ─── Virtual: remaining budget ────────────────────────────────────────────────
CampaignSchema.virtual('remainingBudget').get(function () {
  return parseFloat((this.totalBudget - this.spentBudget).toFixed(4));
});

// Virtual: worker net payout (after 25% platform commission)
CampaignSchema.virtual('workerPayout').get(function () {
  const fee = this.platformFeePercent || 25;
  return parseFloat((this.payoutPerTask * (1 - fee / 100)).toFixed(4));
});

/**
 * Check whether this campaign can still accept new completions.
 */
CampaignSchema.methods.isAcceptingWork = function () {
  if (this.status !== 'active') return false;
  if (this.completionsCount >= this.totalLimit) return false;
  if (this.remainingBudget < this.payoutPerTask) return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  return true;
};

module.exports = mongoose.model('Campaign', CampaignSchema);
