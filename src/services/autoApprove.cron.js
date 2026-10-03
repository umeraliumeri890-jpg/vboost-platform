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
const SystemSetting = require('../models/SystemSetting');
const { notifyUser } = require('./notification.service');
const { processTaskPayout } = require('./ledger.service');
const { syncResellerOffers } = require('./reseller.service');
const logger = require('../config/logger');

/**
 * Process auto-approval for a list of completions.
 */
async function processAutoApprovals(eligibleList, reason = 'auto-approve') {
  const now = new Date();
  for (const completion of eligibleList) {
    if (!completion.campaign) continue;
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
      logger.info(`Auto-approved completion ${completion._id} (${reason})`);

      // In-app notifications
      notifyUser({
        userId: worker._id,
        title: '⚡ Task Proof Auto-Approved',
        message: `Your submission for "${completion.campaign.title}" was auto-approved! $${workerEarning.toFixed(3)} credited to your balance.`,
        type: 'task',
      }).catch(() => {});

      notifyUser({
        userId: advertiser._id,
        title: 'ℹ Task Submission Auto-Approved',
        message: `Task submission for "${completion.campaign.title}" was automatically approved after the review window elapsed.`,
        type: 'task',
      }).catch(() => {});
    } catch (err) {
      await session.abortTransaction();
      logger.error(`Auto-approve failed for ${completion._id}: ${err.message}`);
    } finally {
      session.endSession();
    }
  }
}

// ─── 1. Check autoApproveAt scheduled completions (every minute) ───────────────
cron.schedule('* * * * *', async () => {
  const settings = await SystemSetting.getSettings();
  if (!settings.autoApproveEnabled) return;

  const now = new Date();
  const eligible = await Completion.find({
    status: 'submitted',
    autoApproveAt: { $lte: now },
  }).populate('campaign').limit(50);

  if (eligible.length > 0) {
    await processAutoApprovals(eligible, 'autoApproveAt schedule');
  }
});

// ─── 1b. Hourly Sweep: Auto-Approve Stale Tasks (> 48 hours) ──────────────────
cron.schedule('0 * * * *', async () => {
  const settings = await SystemSetting.getSettings();
  if (!settings.autoApproveEnabled) return;

  const hours = settings.autoApproveHours || 48;
  const threshold = new Date(Date.now() - hours * 3600 * 1000);

  const staleCompletions = await Completion.find({
    status: 'submitted',
    createdAt: { $lte: threshold },
  }).populate('campaign').limit(100);

  if (staleCompletions.length > 0) {
    logger.info(`Hourly Auto-Approve Sweep: found ${staleCompletions.length} submissions older than ${hours}h`);
    await processAutoApprovals(staleCompletions, `stale > ${hours}h`);
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
