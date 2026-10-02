// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { AppError } = require('../utils/errors');
const asyncHandler = require('../utils/asyncHandler');

// ─── JWT Middleware ───────────────────────────────────────────────────────────

/**
 * Protect routes: require valid JWT in Authorization header.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) throw new AppError('Not authenticated. Please log in.', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token expired. Please log in again.', 401);
    }
    throw new AppError('Invalid token.', 401);
  }

  const user = await User.findById(decoded.sub).select('+refreshTokenHash');
  if (!user) throw new AppError('User no longer exists.', 401);
  if (user.isBanned) throw new AppError('Account is banned.', 403);
  if (!user.isActive) throw new AppError('Account is deactivated.', 403);

  req.user = user;
  next();
});

// ─── API Key Middleware ───────────────────────────────────────────────────────

/**
 * Protect routes via API key: reads X-API-Key header.
 * Attaches req.user and req.apiKey.
 */
const apiKeyAuth = asyncHandler(async (req, res, next) => {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey) throw new AppError('API key required.', 401);

  const keyDoc = await ApiKey.findByRawKey(rawKey);
  if (!keyDoc) throw new AppError('Invalid or inactive API key.', 401);

  if (keyDoc.expiresAt && new Date() > keyDoc.expiresAt) {
    throw new AppError('API key has expired.', 401);
  }

  // Daily rate-limit reset
  const now = new Date();
  const hoursSinceReset = (now - keyDoc.lastResetAt) / (1000 * 60 * 60);
  if (hoursSinceReset >= 24) {
    keyDoc.requestCount = 0;
    keyDoc.lastResetAt = now;
  }

  if (keyDoc.requestCount >= keyDoc.rateLimit) {
    throw new AppError('API key daily rate limit exceeded.', 429);
  }

  keyDoc.requestCount += 1;
  keyDoc.lastUsedAt = now;
  keyDoc.lastRequestAt = now;
  await keyDoc.save();

  const user = await User.findById(keyDoc.owner);
  if (!user || user.isBanned || !user.isActive) {
    throw new AppError('Associated account is unavailable.', 403);
  }

  req.user = user;
  req.apiKey = keyDoc;
  next();
});

// ─── Role Guards ─────────────────────────────────────────────────────────────

/**
 * Require one or more roles (from req.user.roles).
 * Usage: restrictTo('admin') or restrictTo('advertiser', 'admin')
 */
const restrictTo = (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new AppError('Not authenticated.', 401));
    const hasRole = roles.some((r) => req.user.roles.includes(r));
    if (!hasRole) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };

/**
 * Scope guard for API-key-authenticated routes.
 * Usage: requireScope('offers:write')
 */
const requireScope = (scope) =>
  (req, res, next) => {
    if (!req.apiKey) return next(new AppError('API key required for this route.', 401));
    if (!req.apiKey.scopes.includes(scope)) {
      return next(new AppError(`API key is missing required scope: ${scope}`, 403));
    }
    next();
  };

/**
 * Accept either JWT or API key.
 * Tries JWT first; falls back to API key if no Bearer token.
 */
const flexAuth = asyncHandler(async (req, res, next) => {
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');
  const hasApiKey = !!req.headers['x-api-key'];

  if (hasBearer) return protect(req, res, next);
  if (hasApiKey) return apiKeyAuth(req, res, next);
  throw new AppError('Authentication required (Bearer token or X-API-Key).', 401);
});

module.exports = { protect, apiKeyAuth, restrictTo, requireScope, flexAuth };
