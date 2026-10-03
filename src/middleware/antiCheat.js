// src/middleware/antiCheat.js
const BannedIp = require('../models/BannedIp');
const SystemSetting = require('../models/SystemSetting');
const Completion = require('../models/Completion');
const { AppError } = require('../utils/errors');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Extracts normalized client IP.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Global IP Blacklist and Maintenance Mode middleware.
 */
const antiCheatFilter = asyncHandler(async (req, res, next) => {
  const ip = getClientIp(req);
  req.clientIp = ip;

  // 1. Check IP Blacklist
  const isBanned = await BannedIp.findOne({ ip });
  if (isBanned) {
    throw new AppError(
      `Access denied: Your IP address (${ip}) has been blocked due to security/anti-cheat rules. Reason: ${isBanned.reason}`,
      403
    );
  }

  // 2. Check Maintenance Mode
  const settings = await SystemSetting.getSettings();
  if (settings.maintenanceMode) {
    // Exempt health check, admin auth, and admin routes
    const isExempt =
      req.path.includes('/health') ||
      req.path.includes('/auth/login') ||
      req.path.startsWith('/api/v1/admin');

    if (!isExempt) {
      if (!req.user || (!req.user.roles?.includes('admin') && req.user.role !== 'admin')) {
        return res.status(503).json({
          status: 'fail',
          message: 'The platform is currently undergoing scheduled maintenance. Please check back shortly.',
        });
      }
    }
  }

  next();
});

/**
 * Guard against multi-account task exploitation:
 * Ensures no other account on the same IP or device fingerprint engages with the same campaign.
 */
const preventMultiAccountTask = asyncHandler(async (req, res, next) => {
  const settings = await SystemSetting.getSettings();
  if (!settings.antiCheatEnabled) return next();

  const ip = req.clientIp || getClientIp(req);
  const fingerprint = req.headers['x-device-fingerprint'] || req.body?.deviceFingerprint;
  const campaignId = req.body?.campaignId;
  const workerId = req.user?._id;

  if (!campaignId || !workerId) return next();

  // Check if ANY other worker on the same IP has accepted this campaign
  const queryConditions = [
    { campaign: campaignId, worker: { $ne: workerId }, workerIp: ip },
  ];

  if (fingerprint) {
    queryConditions.push({
      campaign: campaignId,
      worker: { $ne: workerId },
      deviceFingerprint: fingerprint,
    });
  }

  const existingOtherAccount = await Completion.findOne({
    $or: queryConditions,
    status: { $in: ['accepted', 'submitted', 'pending_review', 'approved', 'auto_approved'] },
  });

  if (existingOtherAccount) {
    throw new AppError(
      'Anti-Cheat Alert: Another account on your local network or device has already accepted this task. Multiple account task completion is strictly prohibited.',
      403
    );
  }

  next();
});

module.exports = {
  getClientIp,
  antiCheatFilter,
  preventMultiAccountTask,
};
