// src/routes/admin.routes.js
/**
 * Super Admin Management API
 * Manage pending payouts, dispute resolutions, campaign moderation, and user bans.
 *
 * All routes require authentication and 'admin' role.
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Completion = require('../models/Completion');
const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');
const { protect, restrictTo } = require('../middleware/auth');
const { NotFoundError, AppError } = require('../utils/errors');
const { creditBalance, debitBalance, processTaskPayout } = require('../services/ledger.service');

// Enforce admin privileges across all admin routes
router.use(protect, restrictTo('admin'));

// ─── GET /api/v1/admin/stats ─────────────────────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalWorkers,
    totalAdvertisers,
    activeCampaigns,
    pendingCompletions,
    disputedCompletions,
    pendingWithdrawals,
    totalPlatformFees,
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ roles: 'worker' }),
    User.countDocuments({ roles: 'advertiser' }),
    Campaign.countDocuments({ status: 'active' }),
    Completion.countDocuments({ status: 'submitted' }),
    Completion.countDocuments({ status: 'disputed' }),
    Transaction.countDocuments({ type: 'withdrawal', status: 'pending' }),
    Transaction.aggregate([
      { $match: { type: 'platform_fee', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  res.json({
    status: 'success',
    data: {
      totalUsers,
      totalWorkers,
      totalAdvertisers,
      activeCampaigns,
      pendingCompletions,
      disputedCompletions,
      pendingWithdrawals,
      totalRevenue: totalPlatformFees[0]?.total || 0,
    },
  });
}));

// ─── GET /api/v1/admin/payouts ───────────────────────────────────────────────
router.get('/payouts', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [payouts, total] = await Promise.all([
    Transaction.find({ type: 'withdrawal' })
      .populate('user', 'username email balances')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments({ type: 'withdrawal' }),
  ]);

  res.json({
    status: 'success',
    data: {
      payouts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}));

// ─── PATCH /api/v1/admin/payouts/:id ─────────────────────────────────────────
router.patch('/payouts/:id', asyncHandler(async (req, res) => {
  const { action, reason } = req.body; // 'approve' | 'reject'
  const txn = await Transaction.findById(req.params.id);
  if (!txn || txn.type !== 'withdrawal') throw new NotFoundError('Withdrawal transaction');

  if (action === 'approve') {
    txn.status = 'completed';
    txn.note = (txn.note || '') + ' [Paid by Admin]';
    await txn.save();
  } else if (action === 'reject') {
    // Refund the amount back to user's main balance
    txn.status = 'failed';
    txn.note = (txn.note || '') + ` [Rejected: ${reason || 'Invalid details'}]`;
    await txn.save();

    await creditBalance({
      userId: txn.user,
      amount: txn.amount,
      balanceType: 'main',
      type: 'refund',
      refs: { transaction: txn._id },
      note: `Refund for rejected withdrawal: ${reason || 'Details rejected'}`,
    });
  } else {
    throw new AppError('Action must be "approve" or "reject"', 400);
  }

  res.json({
    status: 'success',
    message: `Withdrawal ${action}d successfully.`,
    data: { transaction: txn },
  });
}));

// ─── GET /api/v1/admin/disputes ──────────────────────────────────────────────
router.get('/disputes', asyncHandler(async (req, res) => {
  const disputes = await Completion.find({ status: 'disputed' })
    .populate('campaign', 'title category payoutPerTask advertiser')
    .populate('worker', 'username email')
    .sort({ 'dispute.filedAt': -1 });

  res.json({
    status: 'success',
    data: { disputes },
  });
}));

// ─── PATCH /api/v1/admin/disputes/:id ────────────────────────────────────────
router.patch('/disputes/:id', asyncHandler(async (req, res) => {
  const { resolution } = req.body; // 'approve_worker' | 'reject_worker'
  const completion = await Completion.findById(req.params.id).populate('campaign');
  if (!completion || completion.status !== 'disputed') throw new NotFoundError('Dispute');

  if (resolution === 'approve_worker') {
    // Admin overrules advertiser and pays the worker
    await processTaskPayout({
      advertiserId: completion.campaign.advertiser,
      workerId: completion.worker,
      payoutAmount: completion.payoutAmount,
      platformFeePercent: completion.campaign.platformFeePercent,
      completionId: completion._id,
      campaignId: completion.campaign._id,
    });

    completion.status = 'approved';
    completion.paidAt = new Date();
    completion.dispute.resolvedAt = new Date();
    completion.dispute.resolution = 'Overruled by Admin in favor of Worker';
    await completion.save();
  } else if (resolution === 'reject_worker') {
    completion.status = 'rejected';
    completion.dispute.resolvedAt = new Date();
    completion.dispute.resolution = 'Admin confirmed advertiser rejection';
    await completion.save();
  } else {
    throw new AppError('Resolution must be "approve_worker" or "reject_worker"', 400);
  }

  res.json({
    status: 'success',
    message: `Dispute resolved (${resolution}).`,
    data: { completion },
  });
}));

// ─── GET /api/v1/admin/users ─────────────────────────────────────────────────
router.get('/users', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Support search by username or email
  const filter = {};
  if (req.query.search) {
    const re = new RegExp(req.query.search, 'i');
    filter.$or = [{ username: re }, { email: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('username email roles balances gamification stats isBanned banReason socialAccounts createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    data: {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}));

// ─── PATCH /api/v1/admin/users/:id/ban ───────────────────────────────────────
router.patch('/users/:id/ban', asyncHandler(async (req, res) => {
  const { ban, reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User');

  user.isBanned = Boolean(ban);
  user.banReason = ban ? (reason || 'Violation of platform terms') : null;
  await user.save();

  res.json({
    status: 'success',
    message: ban ? `User ${user.username} banned.` : `User ${user.username} unbanned.`,
    data: { isBanned: user.isBanned, banReason: user.banReason },
  });
}));

// ─── GET /api/v1/admin/users/:id ─────────────────────────────────────────────
// Get detailed user profile with transaction and completion history
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-passwordHash -refreshTokenHash -emailVerificationToken -passwordResetToken');
  if (!user) throw new NotFoundError('User');

  const [deposits, withdrawals, completions, campaigns] = await Promise.all([
    Transaction.find({ user: user._id, type: { $in: ['deposit', 'topup'] } })
      .sort({ createdAt: -1 }).limit(20),
    Transaction.find({ user: user._id, type: 'withdrawal' })
      .sort({ createdAt: -1 }).limit(20),
    Completion.find({ worker: user._id })
      .populate('campaign', 'title category payoutPerTask')
      .sort({ createdAt: -1 }).limit(20),
    Campaign.find({ advertiser: user._id })
      .select('title status totalBudget completionsCount createdAt')
      .sort({ createdAt: -1 }).limit(10),
  ]);

  res.json({
    status: 'success',
    data: { user, deposits, withdrawals, completions, campaigns },
  });
}));

// ─── PATCH /api/v1/admin/users/:id/balance ───────────────────────────────────
router.patch('/users/:id/balance', asyncHandler(async (req, res) => {
  const { amount, balanceType, note } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) throw new AppError('Invalid amount.', 400);
  const bType = balanceType === 'ad' ? 'ad' : 'main';

  if (numAmount > 0) {
    await creditBalance({
      userId: req.params.id,
      amount: numAmount,
      balanceType: bType,
      type: 'admin_adjustment',
      note: note || 'Admin balance adjustment',
    });
  } else if (numAmount < 0) {
    await debitBalance({
      userId: req.params.id,
      amount: Math.abs(numAmount),
      balanceType: bType,
      type: 'admin_adjustment',
      note: note || 'Admin balance deduction',
    });
  }

  const updated = await User.findById(req.params.id).select('username balances');
  res.json({
    status: 'success',
    message: `Balance adjusted by $${numAmount.toFixed(2)}`,
    data: { user: updated },
  });
}));

// ─── PATCH /api/v1/admin/users/:id/role ──────────────────────────────────────
router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const { roles } = req.body; // array: ['worker', 'advertiser', 'admin']
  const validRoles = ['worker', 'advertiser', 'admin'];
  if (!Array.isArray(roles) || roles.some((r) => !validRoles.includes(r))) {
    throw new AppError('Roles must be an array containing: worker, advertiser, admin', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { roles },
    { new: true, select: 'username roles' }
  );
  if (!user) throw new NotFoundError('User');

  res.json({
    status: 'success',
    message: `Roles updated for ${user.username}.`,
    data: { user },
  });
}));

// ─── PATCH /api/v1/admin/users/:id/social ────────────────────────────────────
// Admin can unlink a social account
router.patch('/users/:id/social', asyncHandler(async (req, res) => {
  const { platform, handle } = req.body;
  const validPlatforms = ['vk', 'instagram', 'youtube', 'tiktok', 'telegram', 'facebook', 'threads', 'twitter'];
  if (!validPlatforms.includes(platform)) throw new AppError('Invalid platform.', 400);

  const update = {};
  update[`socialAccounts.${platform}`] = handle ? handle.replace(/^@/, '').trim() : null;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true, select: 'username socialAccounts' }
  );
  if (!user) throw new NotFoundError('User');

  res.json({
    status: 'success',
    message: `${platform} account ${handle ? 'updated' : 'unlinked'} for ${user.username}.`,
    data: { socialAccounts: user.socialAccounts },
  });
}));

// ─── GET /api/v1/admin/analytics ─────────────────────────────────────────────
router.get('/analytics', asyncHandler(async (req, res) => {
  const [
    totalTasksPaid,
    totalWorkerPayouts,
    totalPlatformFees,
    totalDeposits,
    totalWithdrawals,
    topWorkers,
    categoryBreakdown,
  ] = await Promise.all([
    Completion.countDocuments({ status: { $in: ['approved', 'auto_approved'] } }),
    Transaction.aggregate([
      { $match: { type: 'task_earn', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'platform_fee', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'deposit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    User.find({ isActive: true })
      .sort({ 'stats.totalEarned': -1 })
      .limit(10)
      .select('username stats.totalEarned stats.tasksCompleted gamification.level'),
    Campaign.aggregate([
      { $group: { _id: '$category', campaigns: { $sum: 1 }, totalBudget: { $sum: '$totalBudget' } } },
      { $sort: { campaigns: -1 } },
      { $limit: 10 },
    ]),
  ]);

  res.json({
    status: 'success',
    data: {
      totalTasksPaid,
      totalWorkerPayouts: totalWorkerPayouts[0]?.total || 0,
      totalPlatformRevenue: totalPlatformFees[0]?.total || 0,
      totalDeposits: totalDeposits[0]?.total || 0,
      totalWithdrawals: totalWithdrawals[0]?.total || 0,
      platformProfitMargin: '25%',
      topWorkers,
      categoryBreakdown,
    },
  });
}));

// ─── GET /api/v1/admin/payments ───────────────────────────────────────────────
router.get('/payments', asyncHandler(async (req, res) => {
  const PaymentRequest = require('../models/PaymentRequest');
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  const [requests, total] = await Promise.all([
    PaymentRequest.find(filter)
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PaymentRequest.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    data: { requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
  });
}));

module.exports = router;
