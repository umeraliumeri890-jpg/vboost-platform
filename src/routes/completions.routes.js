// src/routes/completions.routes.js
/**
 * Task Completion / Proof Submission endpoints.
 *
 * POST   /api/v1/completions                     — Worker accepts + submits proof
 * GET    /api/v1/completions                     — List completions (worker or advertiser)
 * GET    /api/v1/completions/:id                 — Get single completion
 * PATCH  /api/v1/completions/:id/review          — Advertiser approves or rejects
 * PATCH  /api/v1/completions/:id/dispute         — Worker files a dispute
 * POST   /api/v1/completions/:id/proof           — Upload screenshot proof (multipart)
 */
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const path = require('path');
const router = express.Router();

const Campaign = require('../models/Campaign');
const Completion = require('../models/Completion');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { AppError, NotFoundError } = require('../utils/errors');
const { protect } = require('../middleware/auth');
const { processTaskPayout } = require('../services/ledger.service');
const { dispatchWebhook } = require('../utils/webhook');
const { submitToReseller } = require('../services/reseller.service');
const upload = require('../utils/upload');
const SystemSetting = require('../models/SystemSetting');
const { preventMultiAccountTask, getClientIp } = require('../middleware/antiCheat');
const { notifyUser } = require('../services/notification.service');

const XP_PER_TASK = 10;
const SUBMISSION_DEADLINE_MINUTES = 30;

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new AppError('Validation failed', 422, errors.array()));
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/completions — Accept a task
// Worker accepts task. Text/username proof may be submitted here directly.
// Screenshot proof is submitted separately via POST /:id/proof
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/',
  protect,
  preventMultiAccountTask,
  [
    body('campaignId').isMongoId(),
    body('proof.type').isIn(['screenshot', 'text', 'username', 'url', 'none']),
    body('proof.textContent').optional().trim().isLength({ max: 2000 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { campaignId, proof, deviceFingerprint } = req.body;
    const worker = req.user;
    const clientIp = getClientIp(req);
    const fingerprint = req.headers['x-device-fingerprint'] || deviceFingerprint || null;

    const campaign = await Campaign.findById(campaignId).populate('advertiser');
    if (!campaign) throw new NotFoundError('Campaign');
    if (!campaign.isAcceptingWork()) {
      throw new AppError('This campaign is not accepting submissions.', 400);
    }

    // Level gate
    if (worker.gamification.level < campaign.targeting.minLevel) {
      throw new AppError(
        `Level ${campaign.targeting.minLevel} required for this task.`, 403
      );
    }

    // Check per-user completion cap
    const priorCount = await Completion.countDocuments({
      campaign: campaignId,
      worker: worker._id,
    });
    if (priorCount >= campaign.targeting.maxCompletionsPerUser) {
      throw new AppError('You have already completed this task the maximum number of times.', 409);
    }

    // Validate proof type matches campaign requirement
    if (proof.type !== campaign.proofType && campaign.proofType !== 'none') {
      throw new AppError(
        `This campaign requires proof type: ${campaign.proofType}`, 400
      );
    }

    const deadline = new Date(Date.now() + SUBMISSION_DEADLINE_MINUTES * 60 * 1000);
    const settings = await SystemSetting.getSettings();

    const completion = new Completion({
      campaign: campaign._id,
      worker: worker._id,
      payoutAmount: campaign.payoutPerTask,
      proof: {
        type: proof.type,
        textContent: proof.textContent || null,
        submittedAt: proof.type !== 'screenshot' ? new Date() : null,
      },
      status: proof.type === 'screenshot' ? 'accepted' : 'submitted',
      submissionDeadline: deadline,
      workerIp: clientIp,
      deviceFingerprint: fingerprint,
      userAgent: req.headers['user-agent'],
    });

    if (proof.type !== 'screenshot') {
      const delayMs = campaign.autoApprove
        ? (campaign.autoApproveDelay || 0) * 1000
        : (settings.autoApproveHours || 48) * 3600 * 1000;
      completion.autoApproveAt = new Date(Date.now() + delayMs);
    }

    await completion.save();

    // Increment pending task counter
    await Campaign.findByIdAndUpdate(campaign._id, { $inc: { completionsCount: 1 } });
    await User.findByIdAndUpdate(worker._id, { $inc: { 'stats.tasksPending': 1 } });

    // If non-screenshot (text/username) AND it's a reseller task, forward to reseller
    if (proof.type !== 'screenshot') {
      submitToReseller(campaign, proof).catch(() => {});
    }

    res.status(201).json({
      status: 'success',
      message:
        proof.type === 'screenshot'
          ? 'Task accepted. Upload your screenshot proof using POST /completions/:id/proof'
          : 'Proof submitted. Awaiting review.',
      data: { completion },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/completions/:id/proof — Upload screenshot proof
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/:id/proof',
  protect,
  upload.single('screenshot'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('Screenshot file required.', 400);

    const completion = await Completion.findById(req.params.id);
    if (!completion) throw new NotFoundError('Completion');
    if (completion.worker.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden.', 403);
    }
    if (completion.status !== 'accepted') {
      throw new AppError('Proof already submitted or completion not in accepted state.', 400);
    }
    if (new Date() > completion.submissionDeadline) {
      completion.status = 'expired';
      await completion.save();
      throw new AppError('Submission deadline expired.', 410);
    }

    const campaign = await Campaign.findById(completion.campaign);

    // Cloudinary returns secure_url; local disk returns a constructed path
    const screenshotUrl = req.file.path || req.file.secure_url || `/uploads/proofs/${req.file.filename}`;
    completion.proof.screenshotUrl = screenshotUrl;
    completion.proof.submittedAt = new Date();
    completion.status = 'submitted';

    const settings = await SystemSetting.getSettings();
    const delayMs = campaign?.autoApprove
      ? (campaign.autoApproveDelay || 0) * 1000
      : (settings.autoApproveHours || 48) * 3600 * 1000;
    completion.autoApproveAt = new Date(Date.now() + delayMs);

    await completion.save();

    // Forward screenshot to reseller if applicable
    if (campaign) {
      submitToReseller(campaign, { type: 'screenshot', url: screenshotUrl }).catch(() => {});
    }

    res.json({
      status: 'success',
      message: 'Proof uploaded. Awaiting review.',
      data: { completion },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/completions — List completions
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/',
  protect,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional(),
    query('campaignId').optional().isMongoId(),
    query('view').optional().isIn(['worker', 'advertiser']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const view = req.query.view || 'worker';

    let filter = {};

    if (view === 'advertiser') {
      // Find all campaigns owned by this user, then get completions
      const campaignIds = await Campaign.find({ advertiser: req.user._id }).distinct('_id');
      filter.campaign = { $in: campaignIds };
    } else {
      filter.worker = req.user._id;
    }

    if (req.query.campaignId) filter.campaign = req.query.campaignId;
    if (req.query.status) filter.status = req.query.status;

    const [completions, total] = await Promise.all([
      Completion.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('campaign', 'title category payoutPerTask')
        .populate('worker', 'username avatar'),
      Completion.countDocuments(filter),
    ]);

    res.json({
      status: 'success',
      data: { completions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/completions/:id — Get single completion
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const completion = await Completion.findById(req.params.id)
    .populate('campaign')
    .populate('worker', 'username avatar');
  if (!completion) throw new NotFoundError('Completion');
  res.json({ status: 'success', data: { completion } });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/completions/:id/review — Advertiser reviews proof
// Body: { action: 'approve' | 'reject', reason?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/:id/review',
  protect,
  [
    body('action').isIn(['approve', 'reject']),
    body('reason').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { action, reason } = req.body;

    const completion = await Completion.findById(req.params.id).populate('campaign');
    if (!completion) throw new NotFoundError('Completion');

    const campaign = completion.campaign;

    // Verify reviewer is the campaign advertiser (or admin)
    const isOwner = campaign.advertiser.toString() === req.user._id.toString();
    const isAdmin = req.user.roles.includes('admin');
    if (!isOwner && !isAdmin) throw new AppError('Forbidden.', 403);

    if (!['submitted', 'pending_review'].includes(completion.status)) {
      throw new AppError(`Completion is in '${completion.status}' state and cannot be reviewed.`, 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (action === 'approve') {
        const advertiser = await User.findById(campaign.advertiser).session(session);
        const worker = await User.findById(completion.worker).session(session);

        const { workerEarning } = await processTaskPayout({
          advertiser,
          worker,
          amount: completion.payoutAmount,
          campaignId: campaign._id,
          completionId: completion._id,
          session,
        });

        // Award XP and update streak
        const { leveledUp, newLevel } = worker.awardXP(XP_PER_TASK);
        worker.updateStreak();
        worker.stats.tasksCompleted += 1;
        worker.stats.tasksPending = Math.max(0, worker.stats.tasksPending - 1);
        worker.stats.totalEarned += workerEarning;
        worker.gamification.xp += XP_PER_TASK;
        await worker.save({ session });

        // Update campaign budget tracking
        campaign.spentBudget = parseFloat((campaign.spentBudget + completion.payoutAmount).toFixed(4));
        if (campaign.completionsCount >= campaign.totalLimit) {
          campaign.status = 'completed';
        }
        await campaign.save({ session });

        completion.status = 'approved';
        completion.reviewedBy = req.user._id;
        completion.reviewedAt = new Date();
        completion.paidAt = new Date();
        completion.xpAwarded = XP_PER_TASK;
        await completion.save({ session });

        await session.commitTransaction();

        // Fire webhook (non-blocking, outside session)
        if (campaign.webhookUrl && campaign.webhookSecret) {
          dispatchWebhook(campaign.webhookUrl, campaign.webhookSecret, 'completion.approved', {
            completionId: completion._id,
            workerId: worker._id,
            amount: workerEarning,
          }).catch(() => {});
        }

        notifyUser({
          userId: completion.worker,
          title: '✅ Task Proof Approved',
          message: `Your proof for "${campaign.title}" was approved! $${workerEarning.toFixed(3)} credited.`,
          type: 'task',
        }).catch(() => {});

        return res.json({
          status: 'success',
          message: `Proof approved. Worker earned $${workerEarning.toFixed(4)}${leveledUp ? ` and leveled up to ${newLevel}!` : ''}`,
          data: { completion },
        });
      }

      // action === 'reject'
      completion.status = 'rejected';
      completion.reviewedBy = req.user._id;
      completion.reviewedAt = new Date();
      completion.rejectionReason = reason || 'Proof did not meet requirements.';
      await completion.save({ session });

      // Decrement pending stats
      await User.findByIdAndUpdate(
        completion.worker,
        { $inc: { 'stats.tasksPending': -1, 'stats.tasksRejected': 1 } },
        { session }
      );

      // Free the slot so someone else can take it
      await Campaign.findByIdAndUpdate(
        campaign._id,
        { $inc: { completionsCount: -1 } },
        { session }
      );

      await session.commitTransaction();

      if (campaign.webhookUrl && campaign.webhookSecret) {
        dispatchWebhook(campaign.webhookUrl, campaign.webhookSecret, 'completion.rejected', {
          completionId: completion._id,
          reason: completion.rejectionReason,
        }).catch(() => {});
      }

      notifyUser({
        userId: completion.worker,
        title: '❌ Task Proof Rejected',
        message: `Your proof for "${campaign.title}" was rejected: ${completion.rejectionReason}`,
        type: 'task',
      }).catch(() => {});

      res.json({
        status: 'success',
        message: 'Proof rejected.',
        data: { completion },
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/completions/:id/dispute — Worker files a dispute on rejection
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/:id/dispute',
  protect,
  [body('reason').trim().isLength({ min: 20, max: 1000 })],
  validate,
  asyncHandler(async (req, res) => {
    const completion = await Completion.findById(req.params.id).populate('campaign');
    if (!completion) throw new NotFoundError('Completion');
    if (completion.worker.toString() !== req.user._id.toString()) {
      throw new AppError('Forbidden.', 403);
    }
    if (completion.status !== 'rejected') {
      throw new AppError('Only rejected completions can be disputed.', 400);
    }
    if (completion.dispute.filedAt) {
      throw new AppError('Dispute already filed.', 409);
    }

    completion.status = 'disputed';
    completion.dispute.reason = req.body.reason;
    completion.dispute.filedAt = new Date();
    await completion.save();

    if (completion.campaign?.advertiser) {
      notifyUser({
        userId: completion.campaign.advertiser,
        title: '⚠️ Task Submission Disputed',
        message: `Worker disputed your rejection for "${completion.campaign.title}". Routed to Administrator queue.`,
        type: 'dispute',
      }).catch(() => {});
    }

    res.json({
      status: 'success',
      message: 'Dispute filed. An admin will review within 48 hours.',
      data: { completion },
    });
  })
);

module.exports = router;
