// src/routes/webhook.routes.js
/**
 * Inbound Webhook Handler
 *
 * POST /api/v1/webhooks/completion — External reseller notifies us of
 *      completion approval/rejection (used when we submitted a task to VBoost etc.)
 *
 * POST /api/v1/webhooks/deposit — Payment gateway notifies us of a successful
 *      deposit (e.g., PayPal IPN / Stripe webhook / crypto callback).
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Completion = require('../models/Completion');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { verifySignature } = require('../utils/webhook');
const { processTaskPayout, creditBalance } = require('../services/ledger.service');
const logger = require('../config/logger');

/**
 * Raw body middleware — required for HMAC signature verification.
 * Mount this BEFORE express.json() for these routes.
 */
const rawBodyMiddleware = express.raw({ type: 'application/json' });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/webhooks/completion
// External reseller POSTs here when they approve/reject a forwarded completion.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/completion',
  rawBodyMiddleware,
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-microtask-signature'] || req.headers['x-webhook-signature'];
    const secret = process.env.WEBHOOK_SECRET;

    if (!verifySignature(req.body, signature, secret)) {
      logger.warn('Inbound webhook: invalid signature');
      throw new AppError('Invalid webhook signature.', 401);
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      throw new AppError('Invalid JSON payload.', 400);
    }

    const { event, data } = payload;

    logger.info(`Inbound webhook received: ${event}`, { data });

    if (event === 'completion.approved') {
      const completion = await Completion.findOne({
        $or: [
          { _id: data.completionId },
          { 'campaign': data.campaignId, worker: data.workerId },
        ],
      }).populate('campaign');

      if (!completion) {
        return res.json({ status: 'ok', message: 'Completion not found — ignored.' });
      }

      if (!['submitted', 'pending_review'].includes(completion.status)) {
        return res.json({ status: 'ok', message: 'Already processed.' });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const advertiser = await User.findById(completion.campaign.advertiser).session(session);
        const worker = await User.findById(completion.worker).session(session);

        const { workerEarning } = await processTaskPayout({
          advertiser,
          worker,
          amount: completion.payoutAmount,
          campaignId: completion.campaign._id,
          completionId: completion._id,
          session,
        });

        worker.awardXP(10);
        worker.updateStreak();
        worker.stats.tasksCompleted += 1;
        worker.stats.tasksPending = Math.max(0, worker.stats.tasksPending - 1);
        worker.stats.totalEarned += workerEarning;
        await worker.save({ session });

        completion.status = 'auto_approved';
        completion.reviewedAt = new Date();
        completion.paidAt = new Date();
        await completion.save({ session });

        await session.commitTransaction();
        logger.info(`Webhook: auto-approved completion ${completion._id}`);
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } else if (event === 'completion.rejected') {
      const completion = await Completion.findById(data.completionId);
      if (completion && ['submitted', 'pending_review'].includes(completion.status)) {
        completion.status = 'rejected';
        completion.rejectionReason = data.reason || 'Rejected by reseller.';
        completion.reviewedAt = new Date();
        await completion.save();

        await User.findByIdAndUpdate(completion.worker, {
          $inc: { 'stats.tasksPending': -1, 'stats.tasksRejected': 1 },
        });
        logger.info(`Webhook: rejected completion ${completion._id}`);
      }
    } else {
      logger.warn(`Unhandled webhook event: ${event}`);
    }

    // Always respond 200 quickly so sender doesn't retry
    res.json({ status: 'ok' });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/webhooks/deposit
// Payment gateway notifies us a user deposited funds.
// Payload: { userId, amount, balanceType, externalTxId, signature }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/deposit',
  rawBodyMiddleware,
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-microtask-signature'];
    if (!verifySignature(req.body, signature, process.env.WEBHOOK_SECRET)) {
      throw new AppError('Invalid webhook signature.', 401);
    }

    const { userId, amount, balanceType = 'ad', externalTxId } = JSON.parse(req.body.toString());

    if (!userId || !amount || amount <= 0) {
      throw new AppError('Invalid deposit payload.', 400);
    }

    await creditBalance({
      userId,
      amount: parseFloat(amount),
      balanceType,
      type: 'deposit',
      note: `Deposit via payment gateway. Tx: ${externalTxId}`,
    });

    logger.info(`Deposit processed: $${amount} → user ${userId}`);
    res.json({ status: 'ok' });
  })
);

module.exports = router;
