// src/services/notification.service.js
const Notification = require('../models/Notification');
const logger = require('../config/logger');

/**
 * Creates an in-app notification for a user.
 */
async function notifyUser({ userId, title, message, type = 'system', link = null }) {
  try {
    if (!userId) return null;
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      link,
    });
    return notification;
  } catch (err) {
    logger.error(`Failed to create notification for ${userId}: ${err.message}`);
    return null;
  }
}

module.exports = { notifyUser };
