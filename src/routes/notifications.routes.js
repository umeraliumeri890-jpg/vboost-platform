// src/routes/notifications.routes.js
/**
 * In-app Notifications Endpoints
 *
 * GET   /api/v1/notifications           — List notifications & unread count
 * PATCH /api/v1/notifications/:id/read  — Mark single notification as read
 * PATCH /api/v1/notifications/read-all  — Mark all user notifications as read
 */
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError } = require('../utils/errors');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/v1/notifications ────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    const filter = { user: req.user._id };
    if (unreadOnly) {
      filter.read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);

    res.json({
      status: 'success',
      data: {
        notifications,
        unreadCount,
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

// ─── PATCH /api/v1/notifications/read-all ─────────────────────────────────────
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({
      status: 'success',
      message: 'All notifications marked as read.',
    });
  })
);

// ─── PATCH /api/v1/notifications/:id/read ─────────────────────────────────────
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      throw new NotFoundError('Notification not found.');
    }

    res.json({
      status: 'success',
      data: { notification },
    });
  })
);

module.exports = router;
