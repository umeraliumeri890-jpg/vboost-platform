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
const SystemSetting = require('../models/SystemSetting');
const AuditLog = require('../models/AuditLog');
const BannedIp = require('../models/BannedIp');
const asyncHandler = require('../utils/asyncHandler');
const { protect, restrictTo } = require('../middleware/auth');
const { NotFoundError, AppError } = require('../utils/errors');
const { creditBalance, debitBalance, processTaskPayout } = require('../services/ledger.service');
const { logAudit } = require('../services/audit.service');
const { notifyUser } = require('../services/notification.service');
const { getClientIp } = require('../middleware/antiCheat');

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

  // Support search by username, email, registrationIp, or lastLoginIp
  const filter = {};
  if (req.query.search) {
    const re = new RegExp(req.query.search, 'i');
    filter.$or = [
      { username: re },
      { email: re },
      { registrationIp: re },
      { lastLoginIp: re },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('username email roles balances gamification stats isBanned banReason socialAccounts registrationIp lastLoginIp deviceFingerprint createdAt')
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

  await logAudit({
    action: ban ? 'user_banned' : 'user_unbanned',
    performedBy: req.user._id,
    targetUser: user._id,
    details: { reason },
    ip: getClientIp(req),
  });

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

  await logAudit({
    action: 'balance_adjusted',
    performedBy: req.user._id,
    targetUser: req.params.id,
    details: { amount: numAmount, balanceType: bType, note },
    ip: getClientIp(req),
  });

  await notifyUser({
    userId: req.params.id,
    title: numAmount > 0 ? 'Balance Credited' : 'Balance Adjusted',
    message: `Admin adjusted your ${bType} balance by ${numAmount > 0 ? '+' : ''}$${numAmount.toFixed(2)}. ${note ? `Note: ${note}` : ''}`,
    type: 'system',
  });

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

  await logAudit({
    action: 'roles_updated',
    performedBy: req.user._id,
    targetUser: user._id,
    details: { roles },
    ip: getClientIp(req),
  });

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

// ─── GET /api/v1/admin/settings ───────────────────────────────────────────────
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await SystemSetting.getSettings();
    res.json({
      status: 'success',
      data: { settings },
    });
  })
);

// ─── PATCH /api/v1/admin/settings ─────────────────────────────────────────────
router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const allowedFields = [
      'platformFeePercent',
      'referralCommissionPercent',
      'minDeposit',
      'minWithdrawal',
      'minPayoutPerTask',
      'autoApproveHours',
      'autoApproveEnabled',
      'antiCheatEnabled',
      'maintenanceMode',
      'nowPaymentsApiKey',
      'nowPaymentsIpnSecret',
      'coinPaymentsMerchantId',
      'coinPaymentsIpnSecret',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const settings = await SystemSetting.updateSettings(updates);

    await logAudit({
      action: 'system_settings_updated',
      performedBy: req.user._id,
      details: updates,
      ip: getClientIp(req),
    });

    res.json({
      status: 'success',
      message: 'System settings updated successfully.',
      data: { settings },
    });
  })
);

// ─── GET /api/v1/admin/audit-logs ─────────────────────────────────────────────
router.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.targetUser) filter.targetUser = req.query.targetUser;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('performedBy', 'username email')
        .populate('targetUser', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      status: 'success',
      data: {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit) || 1,
          limit,
        },
      },
    });
  })
);

// ─── GET /api/v1/admin/banned-ips ─────────────────────────────────────────────
router.get(
  '/banned-ips',
  asyncHandler(async (req, res) => {
    const bannedIps = await BannedIp.find()
      .populate('bannedBy', 'username email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      status: 'success',
      data: { bannedIps },
    });
  })
);

// ─── POST /api/v1/admin/banned-ips ────────────────────────────────────────────
router.post(
  '/banned-ips',
  asyncHandler(async (req, res) => {
    const { ip, reason } = req.body;
    if (!ip || !ip.trim()) throw new AppError('IP address is required.', 400);

    const cleanIp = ip.trim();
    const existing = await BannedIp.findOne({ ip: cleanIp });
    if (existing) throw new AppError('IP address is already banned.', 400);

    const bannedDoc = await BannedIp.create({
      ip: cleanIp,
      reason: reason || 'Manual Admin Security Ban',
      bannedBy: req.user._id,
    });

    await logAudit({
      action: 'ip_banned',
      performedBy: req.user._id,
      details: { ip: cleanIp, reason },
      ip: getClientIp(req),
    });

    res.status(201).json({
      status: 'success',
      message: `IP ${cleanIp} has been blocked.`,
      data: { bannedIp: bannedDoc },
    });
  })
);

// ─── DELETE /api/v1/admin/banned-ips/:ip ──────────────────────────────────────
router.delete(
  '/banned-ips/:ip',
  asyncHandler(async (req, res) => {
    const targetIp = req.params.ip.trim();
    const removed = await BannedIp.findOneAndDelete({ ip: targetIp });
    if (!removed) throw new NotFoundError('Banned IP record not found.');

    await logAudit({
      action: 'ip_unbanned',
      performedBy: req.user._id,
      details: { ip: targetIp },
      ip: getClientIp(req),
    });

    res.json({
      status: 'success',
      message: `IP ${targetIp} unbanned successfully.`,
    });
  })
);

module.exports = router;
