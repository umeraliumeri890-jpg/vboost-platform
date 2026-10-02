// src/models/Transaction.js
const mongoose = require('mongoose');

/**
 * Immutable ledger record. Every balance change must produce a Transaction.
 * Use double-entry bookkeeping: debit from source, credit to destination.
 */
const TransactionSchema = new mongoose.Schema(
  {
    // ─── Who ────────────────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ─── Classification ─────────────────────────────────────
    type: {
      type: String,
      enum: [
        'deposit',          // User deposits funds to ad balance
        'withdrawal',       // User withdraws from main balance
        'task_earn',        // Worker earns from completing a task
        'task_spend',       // Advertiser spends on task payout
        'platform_fee',     // Platform takes cut on payout
        'refund',           // Advertiser refund on rejected campaign
        'referral_bonus',   // Referral commission
        'ad_balance_top_up',// Internal: deposit → ad balance
        'bonus',            // Admin-issued bonus
      ],
      required: true,
      index: true,
    },

    // ─── Amounts ────────────────────────────────────────────
    amount: { type: Number, required: true }, // Always positive
    currency: { type: String, default: 'USD' },

    // ─── Balance Affected ───────────────────────────────────
    balanceType: {
      type: String,
      enum: ['main', 'ad'],
      required: true,
    },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    // ─── References ─────────────────────────────────────────
    relatedCompletion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Completion',
      default: null,
    },
    relatedCampaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
    },
    relatedUser: {
      // e.g. referrer
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ─── Status ─────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
    },

    // ─── External Payment ───────────────────────────────────
    externalTxId: { type: String, default: null }, // PayPal / crypto txn ID
    payoutMethod: { type: String, default: null },

    note: { type: String, maxlength: 500, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    // Prevent accidental updates — ledger should be append-only
    versionKey: false,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, status: 1 });
TransactionSchema.index({ relatedCompletion: 1 }, { sparse: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
