// src/routes/auth.routes.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  buildAuthResponse,
} = require('../utils/jwt');
const { protect } = require('../middleware/auth');
const { getClientIp } = require('../middleware/antiCheat');

// ─── Validation helpers ───────────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 422, errors.array()));
  }
  next();
};

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3–30 chars, letters/numbers/underscores only'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('referralCode').optional().trim(),
    body('ref').optional().trim(),
    body('deviceFingerprint').optional().trim(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { username, email, password, referralCode, ref, deviceFingerprint } = req.body;
    const clientIp = getClientIp(req);

    // Check uniqueness
    const existing = await User.findOne({
      $or: [{ email }, { username }],
    });
    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      throw new AppError(`${field} is already in use.`, 409);
    }

    // Resolve referrer (by code OR by username)
    let referredBy = null;
    const refKey = (referralCode || ref || '').trim();
    if (refKey) {
      const referrer = await User.findOne({
        $or: [
          { referralCode: refKey },
          { username: new RegExp(`^${refKey}$`, 'i') },
        ],
      });
      if (referrer) referredBy = referrer._id;
    }

    // Generate unique referral code
    const newReferralCode = `${username.toLowerCase()}_${Date.now().toString(36)}`;

    const user = new User({
      username,
      email,
      passwordHash: password, // pre-save hook hashes this
      referredBy,
      referralCode: newReferralCode,
      registrationIp: clientIp,
      lastLoginIp: clientIp,
      deviceFingerprint: deviceFingerprint || null,
      ipAddresses: [{ ip: clientIp, recordedAt: new Date() }],
    });
    await user.save();

    // If referred, increment referrer's invited count if any
    if (referredBy) {
      User.findByIdAndUpdate(referredBy, {
        $inc: { 'stats.tasksCompleted': 0, referralEarnings: 0 },
      }).exec().catch(() => {});
    }

    const accessToken = signAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully.',
      data: buildAuthResponse(user, accessToken, refreshToken),
    });
  })
);

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    body('deviceFingerprint').optional().trim(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password, deviceFingerprint } = req.body;
    const clientIp = getClientIp(req);

    const user = await User.findOne({ email }).select('+passwordHash +refreshTokenHash');
    if (!user) throw new AppError('Invalid email or password.', 401);
    if (user.isBanned) throw new AppError(`Account banned: ${user.banReason}`, 403);
    if (!user.isActive) throw new AppError('Account is deactivated.', 403);

    const valid = await user.comparePassword(password);
    if (!valid) throw new AppError('Invalid email or password.', 401);

    // Update login metadata & anti-cheat records
    user.lastLoginAt = new Date();
    user.lastLoginIp = clientIp;
    if (deviceFingerprint) {
      user.deviceFingerprint = deviceFingerprint;
    }
    if (!user.ipAddresses) {
      user.ipAddresses = [];
    }
    user.ipAddresses.push({ ip: clientIp, recordedAt: new Date() });

    const accessToken = signAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();

    res.json({
      status: 'success',
      data: buildAuthResponse(user, accessToken, refreshToken),
    });
  })
);

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required.', 400);

    const tokenHash = hashRefreshToken(refreshToken);
    const user = await User.findOne({ refreshTokenHash: tokenHash }).select(
      '+refreshTokenHash'
    );
    if (!user) throw new AppError('Invalid refresh token.', 401);

    const accessToken = signAccessToken(user._id);
    const newRefresh = generateRefreshToken();
    user.refreshTokenHash = hashRefreshToken(newRefresh);
    await user.save();

    res.json({
      status: 'success',
      data: { accessToken, refreshToken: newRefresh },
    });
  })
);

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
router.post('/logout', protect, asyncHandler(async (req, res) => {
  req.user.refreshTokenHash = null;
  await req.user.save();
  res.json({ status: 'success', message: 'Logged out.' });
}));

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
router.get('/me', protect, asyncHandler(async (req, res) => {
  res.json({ status: 'success', data: { user: req.user } });
}));

// ─── API KEY MANAGEMENT ───────────────────────────────────────────────────────

// POST /api/v1/auth/api-keys — Create a new API key
router.post(
  '/api-keys',
  protect,
  [
    body('name').trim().isLength({ min: 1, max: 60 }),
    body('scopes').optional().isArray(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, scopes } = req.body;
    const { apiKey, doc } = await ApiKey.generate(req.user._id, name, scopes);

    res.status(201).json({
      status: 'success',
      message: 'API key created. Save the key — it will not be shown again.',
      data: {
        apiKey,          // RAW key — shown once
        prefix: doc.keyPrefix,
        scopes: doc.scopes,
        id: doc._id,
      },
    });
  })
);

// GET /api/v1/auth/api-keys — List your API keys
router.get('/api-keys', protect, asyncHandler(async (req, res) => {
  const keys = await ApiKey.find({ owner: req.user._id }).select('-keyHash');
  res.json({ status: 'success', data: { keys } });
}));

// DELETE /api/v1/auth/api-keys/:id — Revoke an API key
router.delete('/api-keys/:id', protect, asyncHandler(async (req, res) => {
  const key = await ApiKey.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    { isActive: false },
    { new: true }
  );
  if (!key) throw new AppError('API key not found.', 404);
  res.json({ status: 'success', message: 'API key revoked.' });
}));

module.exports = router;
