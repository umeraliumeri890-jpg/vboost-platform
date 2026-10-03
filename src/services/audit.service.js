// src/services/audit.service.js
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

/**
 * Records an entry in the administrative audit logs.
 */
async function logAudit({ action, performedBy, targetUser = null, details = {}, ip = null }) {
  try {
    const log = await AuditLog.create({
      action,
      performedBy,
      targetUser,
      details,
      ip,
    });
    return log;
  } catch (err) {
    logger.error(`Failed to record audit log: ${err.message}`);
    return null;
  }
}

module.exports = { logAudit };
