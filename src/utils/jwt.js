// src/utils/jwt.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Issue a short-lived access token.
 */
const signAccessToken = (userId) =>
  jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'microtask-platform',
  });

/**
 * Issue a long-lived refresh token (opaque random string).
 * Store the hash server-side (refreshTokenHash on User).
 */
const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Build the standard auth response object.
 */
const buildAuthResponse = (user, accessToken, refreshToken) => ({
  accessToken,
  refreshToken,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  user: {
    id: user._id,
    username: user.username,
    email: user.email,
    roles: user.roles,
    balances: user.balances,
    gamification: {
      level: user.gamification.level,
      xp: user.gamification.xp,
      streakDays: user.gamification.streakDays,
    },
    stats: user.stats,
    isVerified: user.isVerified,
    socialAccounts: user.socialAccounts || {},
  },
});

module.exports = { signAccessToken, generateRefreshToken, hashRefreshToken, buildAuthResponse };
