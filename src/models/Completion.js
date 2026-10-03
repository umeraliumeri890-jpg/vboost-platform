// src/models/Completion.js
const mongoose = require('mongoose');

/**
 * A Completion represents one worker's attempt at one Campaign task.
 * Status lifecycle:
 *   accepted → submitted → (pending_review) → approved | rejected
 *                                          └→ auto_approved
 */
const CompletionSchema = new mongoose.Schema(
  {
    // ─── Relations ──────────────────────────────────────────
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ─── Proof Submission ───────────────────────────────────
    proof: {
      type: {
        type: String,
        enum: ['screenshot', 'text', 'username', 'url', 'none'],
        required: true,
      },
      screenshotUrl: { type: String, default: null }, // stored file path / CDN URL
      textContent: { type: String, maxlength: 2000, default: null },
      submittedAt: { type: Date, default: null },
    },

    // ─── Status Machine ─────────────────────────────────────
    status: {
      type: String,
      enum: [
        'accepted',      // Worker accepted the task, hasn't submitted proof yet
        'submitted',     // Proof submitted, awaiting review
        'pending_review',// Flagged for manual review
        'approved',      // Approved by advertiser or auto
        'auto_approved', // Auto-approved after delay
        'rejected',      // Proof rejected
        'expired',       // Worker took too long to submit
        'disputed',      // Worker disputed rejection
      ],
      default: 'accepted',
      index: true,
    },

    // ─── Financials ─────────────────────────────────────────
    payoutAmount: { type: Number, required: true }, // Locked in at submission time
    xpAwarded: { type: Number, default: 0 },
    paidAt: { type: Date, default: null },

    // ─── Review Details ─────────────────────────────────────
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    }, // null = auto
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, maxlength: 500, default: null },

    // ─── Dispute ────────────────────────────────────────────
    dispute: {
      reason: { type: String, maxlength: 1000, default: null },
      filedAt: { type: Date, default: null },
      resolvedAt: { type: Date, default: null },
      resolution: { type: String, enum: ['upheld', 'overturned', null], default: null },
    },

    // ─── Timing ─────────────────────────────────────────────
    acceptedAt: { type: Date, default: Date.now },
    submissionDeadline: { type: Date }, // typically acceptedAt + 30min
    autoApproveAt: { type: Date, default: null }, // Set on submission for auto-approve

    // ─── Worker Context ─────────────────────────────────────
    workerIp: { type: String, default: null, index: true },
    userAgent: { type: String, default: null },
    deviceFingerprint: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

// ─── Unique constraint: one active attempt per worker per campaign ─────────────
CompletionSchema.index(
  { campaign: 1, worker: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['accepted', 'submitted', 'pending_review', 'approved', 'auto_approved'] },
    },
  }
);

CompletionSchema.index({ status: 1, autoApproveAt: 1 }); // For cron auto-approve job
CompletionSchema.index({ campaign: 1, workerIp: 1 });
CompletionSchema.index({ campaign: 1, deviceFingerprint: 1 });
CompletionSchema.index({ worker: 1, createdAt: -1 });
CompletionSchema.index({ campaign: 1, status: 1 });

module.exports = mongoose.model('Completion', CompletionSchema);
