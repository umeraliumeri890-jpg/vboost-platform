// src/services/ledger.service.js
/**
 * Ledger Service — single source of truth for all balance mutations.
 * Always call these functions inside a Mongoose session (transaction).
 */
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { AppError } = require('../utils/errors');

/**
 * Credit a user's balance and record the transaction.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {number} opts.amount        - Must be positive
 * @param {'main'|'ad'} opts.balanceType
 * @param {string} opts.type          - Transaction type enum
 * @param {object} [opts.refs]        - { relatedCompletion, relatedCampaign, relatedUser }
 * @param {string} [opts.note]
 * @param {object} [opts.session]     - Mongoose session
 */
const creditBalance = async (opts) => {
  const { userId, amount, balanceType, type, refs = {}, note, session } = opts;

  if (amount <= 0) throw new AppError('Credit amount must be positive.', 400);

  const user = await User.findById(userId).session(session || null);
  if (!user) throw new AppError('User not found.', 404);

  const before = user.balances[balanceType];
  user.balances[balanceType] = parseFloat((before + amount).toFixed(4));

  await user.save({ session });

  const txn = new Transaction({
    user: userId,
    type,
    amount,
    balanceType,
    balanceBefore: before,
    balanceAfter: user.balances[balanceType],
    status: 'completed',
    note,
    ...refs,
  });

  await txn.save({ session });
  return { user, transaction: txn };
};

/**
 * Debit a user's balance (with insufficient-funds guard).
 */
const debitBalance = async (opts) => {
  const { userId, amount, balanceType, type, refs = {}, note, session } = opts;

  if (amount <= 0) throw new AppError('Debit amount must be positive.', 400);

  const user = await User.findById(userId).session(session || null);
  if (!user) throw new AppError('User not found.', 404);

  const before = user.balances[balanceType];
  if (before < amount) {
    throw new AppError(
      `Insufficient ${balanceType} balance. Required: $${amount.toFixed(2)}, Available: $${before.toFixed(2)}`,
      402
    );
  }

  user.balances[balanceType] = parseFloat((before - amount).toFixed(4));
  await user.save({ session });

  const txn = new Transaction({
    user: userId,
    type,
    amount,
    balanceType,
    balanceBefore: before,
    balanceAfter: user.balances[balanceType],
    status: 'completed',
    note,
    ...refs,
  });

  await txn.save({ session });
  return { user, transaction: txn };
};

/**
 * Process a task payout:
 * 1. Debit advertiser's ad balance (full amount)
 * 2. Credit worker's main balance (amount minus platform fee)
 * 3. Record platform fee transaction
 *
 * Must be called within a Mongoose session.
 */
const processTaskPayout = async ({ advertiser, worker, amount, campaignId, completionId, session }) => {
  const SystemSetting = require('../models/SystemSetting');
  const { notifyUser } = require('./notification.service');

  const settings = await SystemSetting.getSettings();
  const feePercent = settings.platformFeePercent ?? 25;
  const platformFee = parseFloat(((amount * feePercent) / 100).toFixed(4));
  const workerEarning = parseFloat((amount - platformFee).toFixed(4));

  const refs = {
    relatedCampaign: campaignId,
    relatedCompletion: completionId,
  };

  // 1. Debit advertiser
  await debitBalance({
    userId: advertiser._id,
    amount,
    balanceType: 'ad',
    type: 'task_spend',
    refs,
    note: `Task payout for completion ${completionId}`,
    session,
  });

  // 2. Credit worker (net of fee)
  const { user: updatedWorker, transaction: earnTxn } = await creditBalance({
    userId: worker._id,
    amount: workerEarning,
    balanceType: 'main',
    type: 'task_earn',
    refs: { ...refs, relatedUser: advertiser._id },
    note: `Earned from task (75% payout, platform fee: ${feePercent}%)`,
    session,
  });

  // 3. Log platform fee
  const feeTxn = new Transaction({
    user: advertiser._id,
    type: 'platform_fee',
    amount: platformFee,
    balanceType: 'ad',
    balanceBefore: advertiser.balances.ad,
    balanceAfter: advertiser.balances.ad - amount,
    status: 'completed',
    note: `Platform revenue (${feePercent}%)`,
    ...refs,
  });
  await feeTxn.save({ session });

  // 4. Automated Referral System: Award commission to worker's referrer
  const referralPercent = settings.referralCommissionPercent ?? 5;
  if (worker.referredBy && referralPercent > 0) {
    const referralBonus = parseFloat(((workerEarning * referralPercent) / 100).toFixed(4));
    if (referralBonus > 0) {
      await creditBalance({
        userId: worker.referredBy,
        amount: referralBonus,
        balanceType: 'main',
        type: 'referral_bonus',
        refs: { ...refs, relatedUser: worker._id },
        note: `Referral commission (${referralPercent}%) from worker @${worker.username}`,
        session,
      });

      await User.findByIdAndUpdate(
        worker.referredBy,
        { $inc: { referralEarnings: referralBonus } },
        { session }
      );

      // Async notification to referrer
      notifyUser({
        userId: worker.referredBy,
        title: '💰 Referral Commission Earned!',
        message: `You received a $${referralBonus.toFixed(3)} referral bonus (${referralPercent}%) from @${worker.username}'s completed task!`,
        type: 'referral',
      }).catch(() => {});
    }
  }

  // Notify worker of payout
  notifyUser({
    userId: worker._id,
    title: '✅ Task Payout Received',
    message: `You earned $${workerEarning.toFixed(3)} from your submitted task proof!`,
    type: 'task',
  }).catch(() => {});

  return { workerEarning, platformFee, earnTxn };
};

module.exports = { creditBalance, debitBalance, processTaskPayout };
