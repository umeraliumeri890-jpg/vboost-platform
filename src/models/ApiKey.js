// src/models/ApiKey.js
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * API keys for external advertiser integrations.
 * The raw key is shown ONCE on creation; only the hash is stored.
 */
const ApiKeySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 60 }, // Human label
    keyHash: { type: String, required: true, unique: true, select: false },
    keyPrefix: { type: String, required: true }, // First 8 chars, shown in UI for identification

    // ─── Permissions ────────────────────────────────────────
    scopes: {
      type: [String],
      enum: ['offers:read', 'offers:write', 'completions:read', 'webhooks:manage', 'stats:read'],
      default: ['offers:read', 'offers:write', 'completions:read'],
    },

    // ─── Rate Limiting ──────────────────────────────────────
    rateLimit: { type: Number, default: 1000 }, // requests / day
    requestCount: { type: Number, default: 0 },
    lastRequestAt: { type: Date, default: null },
    lastResetAt: { type: Date, default: Date.now },

    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ApiKeySchema.index({ owner: 1, isActive: 1 });

/**
 * Static helper: generate a new key + store its hash.
 * Returns { apiKey (raw), doc }
 */
ApiKeySchema.statics.generate = async function (ownerId, name, scopes) {
  const rawKey = `mk_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 10); // "mk_" + 7 chars

  const doc = await this.create({
    owner: ownerId,
    name,
    scopes,
    keyHash,
    keyPrefix,
  });

  return { apiKey: rawKey, doc };
};

/**
 * Find a key document by raw key string.
 */
ApiKeySchema.statics.findByRawKey = async function (rawKey) {
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return this.findOne({ keyHash, isActive: true }).select('+keyHash');
};

module.exports = mongoose.model('ApiKey', ApiKeySchema);
