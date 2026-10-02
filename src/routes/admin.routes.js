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
const { creditBalance, processTaskPayout } = require('../services/ledger.service');

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

  const [users, total] = await Promise.all([
    User.find()
      .select('username email roles balances gamification stats isBanned banReason createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(),
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

module.exports = router;
