// src/services/autoApprove.cron.js
/**
 * Cron Jobs
 *
 * 1. Auto-approve completions: every minute, find completions where
 *    autoApproveAt <= now, status = 'submitted', and process them.
 *
 * 2. Expire stale acceptances: every 5 minutes, mark 'accepted'
 *    completions whose deadline has passed as 'expired'.
 *
 * 3. Reseller sync: every 30 minutes, fetch external tasks.
 *
 * 4. Complete exhausted campaigns: every hour, mark campaigns with
 *    zero remaining budget/slots as 'completed'.
 */
const cron = require('node-cron');
const mongoose = require('mongoose');
const Completion = require('../models/Completion');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { processTaskPayout } = require('./ledger.service');
const { syncResellerOffers } = require('./reseller.service');
const logger = require('../config/logger');

// ─── 1. Auto-approve eligible completions (every minute) ─────────────────────
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const eligible = await Completion.find({
    status: 'submitted',
    autoApproveAt: { $lte: now },
  }).populate('campaign');

  if (eligible.length === 0) return;
  logger.info(`Auto-approve cron: processing ${eligible.length} completions`);

  for (const completion of eligible) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const advertiser = await User.findById(completion.campaign.advertiser).session(session);
      const worker = await User.findById(completion.worker).session(session);

      if (!advertiser || !worker) {
        completion.status = 'rejected';
        completion.rejectionReason = 'System error: user not found';
        await completion.save({ session });
        await session.commitTransaction();
        continue;
      }

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

      completion.campaign.spentBudget = parseFloat(
        (completion.campaign.spentBudget + completion.payoutAmount).toFixed(4)
      );
      await completion.campaign.save({ session });

      completion.status = 'auto_approved';
      completion.reviewedAt = now;
      completion.paidAt = now;
      completion.xpAwarded = 10;
      await completion.save({ session });

      await session.commitTransaction();
      logger.debug(`Auto-approved completion ${completion._id}`);
    } catch (err) {
      await session.abortTransaction();
      logger.error(`Auto-approve failed for ${completion._id}: ${err.message}`);
    } finally {
      session.endSession();
    }
  }
});

// ─── 2. Expire stale task acceptances (every 5 minutes) ─────────────────────
cron.schedule('*/5 * * * *', async () => {
  const now = new Date();
  const result = await Completion.updateMany(
    { status: 'accepted', submissionDeadline: { $lt: now } },
    { $set: { status: 'expired' } }
  );

  if (result.modifiedCount > 0) {
    logger.info(`Expired ${result.modifiedCount} stale task acceptances`);
    // Free their slots
    const expired = await Completion.find({ status: 'expired', paidAt: null });
    for (const c of expired) {
      await Campaign.findByIdAndUpdate(c.campaign, { $inc: { completionsCount: -1 } });
    }
  }
});

// ─── 3. Reseller sync (every 30 minutes) ─────────────────────────────────────
cron.schedule('*/30 * * * *', async () => {
  const activeCampaignCount = await Campaign.countDocuments({ status: 'active', source: 'internal' });
  const threshold = parseInt(process.env.RESELLER_THRESHOLD) || 10;

  if (activeCampaignCount < threshold) {
    logger.info(`Low campaign inventory (${activeCampaignCount}). Syncing reseller offers...`);
    await syncResellerOffers(50);
  }
});

// ─── 4. Auto-complete exhausted campaigns (every hour) ───────────────────────
cron.schedule('0 * * * *', async () => {
  const result = await Campaign.updateMany(
    {
      status: 'active',
      $expr: { $gte: ['$completionsCount', '$totalLimit'] },
    },
    { $set: { status: 'completed' } }
  );
  if (result.modifiedCount > 0) {
    logger.info(`Marked ${result.modifiedCount} campaigns as completed`);
  }
});

logger.info('Cron jobs registered: auto-approve, expire, reseller-sync, campaign-complete');
