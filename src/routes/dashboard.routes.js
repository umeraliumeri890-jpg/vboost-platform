// src/routes/dashboard.routes.js
/**
 * Dashboard & User Profile endpoints.
 *
 * GET /api/v1/dashboard          — Full dashboard summary for current user
 * GET /api/v1/dashboard/leaderboard — Top workers by XP
 * GET /api/v1/dashboard/transactions — Paginated transaction history
 * GET /api/v1/dashboard/profile/:username — Public profile
 */
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Completion = require('../models/Completion');
const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/auth');
const { NotFoundError } = require('../utils/errors');

// ─── GET /api/v1/dashboard ───────────────────────────────────────────────────
router.get('/', protect, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [
    recentCompletions,
    activeCampaigns,
    recentTransactions,
    pendingReviewCount,
  ] = await Promise.all([
    Completion.find({ worker: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('campaign', 'title category'),
    Campaign.find({ advertiser: userId, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(5),
    Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10),
    Completion.countDocuments({ worker: userId, status: { $in: ['submitted', 'pending_review'] } }),
  ]);

  // XP to next level
  const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3100, 4200, 5500];
  const level = req.user.gamification.level;
  const xp = req.user.gamification.xp;
  const nextLevelXp = LEVEL_THRESHOLDS[level] || null; // null = max level
  const xpToNext = nextLevelXp ? Math.max(0, nextLevelXp - xp) : 0;

  res.json({
    status: 'success',
    data: {
      user: {
        id: req.user._id,
        username: req.user.username,
        avatar: req.user.avatar,
        balances: req.user.balances,
        gamification: {
          ...req.user.gamification.toObject(),
          xpToNextLevel: xpToNext,
          nextLevelThreshold: nextLevelXp,
        },
        stats: req.user.stats,
        referralCode: req.user.referralCode,
        socialAccounts: req.user.socialAccounts || {},
      },
      pendingReviewCount,
      recentCompletions,
      activeCampaigns,
      recentTransactions,
    },
  });
}));

// ─── POST /api/v1/dashboard/withdraw ─────────────────────────────────────────
router.post('/withdraw', protect, asyncHandler(async (req, res) => {
  const { amount, method, details } = req.body;
  const numAmount = parseFloat(amount);
  const minWithdrawal = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT) || 1.0;

  if (isNaN(numAmount) || numAmount < minWithdrawal) {
    return res.status(400).json({
      status: 'fail',
      message: `Minimum withdrawal amount is $${minWithdrawal.toFixed(2)} (or equivalent).`,
    });
  }

  const { debitBalance } = require('../services/ledger.service');
  const { user, transaction } = await debitBalance({
    userId: req.user._id,
    amount: numAmount,
    balanceType: 'main',
    type: 'withdrawal',
    note: `Withdrawal via ${method || 'Bank/Wallet'}: ${details || 'N/A'}`,
  });

  res.json({
    status: 'success',
    message: `Withdrawal of $${numAmount.toFixed(2)} processed successfully.`,
    data: {
      balances: user.balances,
      transaction,
    },
  });
}));

// ─── POST /api/v1/dashboard/topup ────────────────────────────────────────────
router.post('/topup', protect, asyncHandler(async (req, res) => {
  const { amount, paymentMethod } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ status: 'fail', message: 'Invalid top-up amount.' });
  }

  const { creditBalance } = require('../services/ledger.service');
  const { user, transaction } = await creditBalance({
    userId: req.user._id,
    amount: numAmount,
    balanceType: 'ad',
    type: 'deposit',
    note: `Ad balance top-up via ${paymentMethod || 'Instant Simulator'}`,
  });

  res.json({
    status: 'success',
    message: `$${numAmount.toFixed(2)} added to your Ad Balance!`,
    data: {
      balances: user.balances,
      transaction,
    },
  });
}));

// ─── PATCH /api/v1/dashboard/social-accounts ──────────────────────────────────
router.patch('/social-accounts', protect, asyncHandler(async (req, res) => {
  const { platform, handle } = req.body;
  const validPlatforms = ['vk', 'instagram', 'youtube', 'tiktok', 'telegram', 'facebook', 'threads', 'twitter'];

  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({ status: 'fail', message: 'Invalid social platform.' });
  }

  if (!req.user.socialAccounts) {
    req.user.socialAccounts = {};
  }

  req.user.socialAccounts[platform] = handle ? handle.replace(/^@/, '').trim() : null;
  await req.user.save();

  res.json({
    status: 'success',
    message: `${platform} account updated.`,
    data: { socialAccounts: req.user.socialAccounts },
  });
}));

// ─── POST /api/v1/dashboard/claim-daily-streak ───────────────────────────────
router.post('/claim-daily-streak', protect, asyncHandler(async (req, res) => {
  const user = req.user;
  const now = new Date();
  const lastActive = user.gamification.lastActivityDate;

  // Streak reward formula: +0.020 base, plus 0.010 for each day of streak
  const streakBonus = parseFloat((0.020 + (user.gamification.streakDays * 0.010)).toFixed(3));

  user.updateStreak();
  user.awardXP(15);
  user.balances.main = parseFloat((user.balances.main + streakBonus).toFixed(4));
  await user.save();

  const Transaction = require('../models/Transaction');
  await Transaction.create({
    user: user._id,
    type: 'bonus',
    amount: streakBonus,
    balanceType: 'main',
    balanceBefore: user.balances.main - streakBonus,
    balanceAfter: user.balances.main,
    note: `Daily streak bonus (Day ${user.gamification.streakDays})`,
  });

  res.json({
    status: 'success',
    message: `Streak bonus claimed! +$${streakBonus.toFixed(3)} and +15 XP!`,
    data: {
      streakDays: user.gamification.streakDays,
      balances: user.balances,
      xp: user.gamification.xp,
    },
  });
}));

// ─── GET /api/v1/dashboard/leaderboard ───────────────────────────────────────
router.get('/leaderboard', protect, asyncHandler(async (req, res) => {
  const top = await User.find({ isActive: true, isBanned: false })
    .sort({ 'gamification.xp': -1 })
    .limit(50)
    .select('username avatar gamification.xp gamification.level stats.tasksCompleted');

  res.json({ status: 'success', data: { leaderboard: top } });
}));

// ─── GET /api/v1/dashboard/transactions ──────────────────────────────────────
router.get('/transactions', protect, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const filter = { user: req.user._id };
  if (req.query.type) filter.type = req.query.type;

  const [txns, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Transaction.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    data: { transactions: txns, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
  });
}));

// ─── GET /api/v1/dashboard/profile/:username ─────────────────────────────────
router.get('/profile/:username', asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username, isActive: true });
  if (!user) throw new NotFoundError('User');
  res.json({ status: 'success', data: { profile: user.toPublicProfile() } });
}));

module.exports = router;
