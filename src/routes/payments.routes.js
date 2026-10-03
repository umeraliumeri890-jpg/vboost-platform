// src/routes/payments.routes.js
/**
 * Payment Request endpoints — Deposits & Withdrawals.
 *
 * POST /api/v1/payments/deposit          — Submit crypto deposit request with TXID
 * POST /api/v1/payments/withdraw         — Submit crypto/fiat withdrawal request
 * GET  /api/v1/payments/my               — List user's payment requests
 * PATCH /api/v1/payments/admin/:id       — Admin: approve/reject payment request
 * GET  /api/v1/payments/admin/pending    — Admin: all pending payment requests
 * GET  /api/v1/payments/addresses        — Get platform deposit addresses by network
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const PaymentRequest = require('../models/PaymentRequest');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { creditBalance, debitBalance } = require('../services/ledger.service');

// Platform receiving addresses (set in .env)
const PLATFORM_ADDRESSES = {
  USDT_TRC20: process.env.WALLET_USDT_TRC20 || 'TXxxx_USDT_TRC20_ADDRESS',
  USDT_BEP20: process.env.WALLET_USDT_BEP20 || '0xxxx_USDT_BEP20_ADDRESS',
  BTC:        process.env.WALLET_BTC || 'bc1xxx_BTC_ADDRESS',
  LTC:        process.env.WALLET_LTC || 'ltc1xxx_LTC_ADDRESS',
  SOL:        process.env.WALLET_SOL || 'SOLxxx_SOL_ADDRESS',
};

const MIN_DEPOSIT  = parseFloat(process.env.MIN_DEPOSIT_AMOUNT)  || 1.0;
const MIN_WITHDRAW = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT) || 1.0;

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ status: 'fail', message: 'Validation failed', errors: errors.array() });
  }
  next();
};

// ─── GET /api/v1/payments/addresses ──────────────────────────────────────────
router.get('/addresses', protect, (req, res) => {
  res.json({
    status: 'success',
    data: { addresses: PLATFORM_ADDRESSES },
  });
});

// ─── POST /api/v1/payments/deposit ───────────────────────────────────────────
router.post(
  '/deposit',
  protect,
  [
    body('amount').isFloat({ min: MIN_DEPOSIT }).withMessage(`Minimum deposit is $${MIN_DEPOSIT}`),
    body('paymentMethod').isIn(['USDT_TRC20', 'USDT_BEP20', 'BTC', 'LTC', 'SOL']).withMessage('Invalid payment method'),
    body('txid').trim().isLength({ min: 10, max: 200 }).withMessage('Valid transaction ID (TXID) is required'),
    body('balanceTarget').optional().isIn(['main', 'ad']).withMessage('Balance target must be main or ad'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { amount, paymentMethod, txid, balanceTarget = 'ad' } = req.body;

    // Check for duplicate TXID
    const existing = await PaymentRequest.findOne({ txid, type: 'deposit' });
    if (existing) {
      return res.status(409).json({
        status: 'fail',
        message: 'This transaction ID has already been submitted. Please wait for admin approval.',
      });
    }

    const request = await PaymentRequest.create({
      user: req.user._id,
      type: 'deposit',
      balanceTarget,
      amount: parseFloat(amount),
      paymentMethod,
      txid,
      networkAddress: PLATFORM_ADDRESSES[paymentMethod] || null,
    });

    res.status(201).json({
      status: 'success',
      message: 'Deposit request submitted. Admin will verify and credit your balance within 30 minutes.',
      data: { request },
    });
  })
);

// ─── POST /api/v1/payments/withdraw ──────────────────────────────────────────
router.post(
  '/withdraw',
  protect,
  [
    body('amount').isFloat({ min: MIN_WITHDRAW }).withMessage(`Minimum withdrawal is $${MIN_WITHDRAW}`),
    body('paymentMethod').isIn(['USDT_TRC20', 'USDT_BEP20', 'BTC', 'LTC', 'SOL', 'bank_card', 'payeer', 'qiwi', 'paypal', 'other'])
      .withMessage('Invalid payment method'),
    body('destinationAddress').trim().isLength({ min: 5, max: 200 }).withMessage('Destination address is required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { amount, paymentMethod, destinationAddress, destinationNote } = req.body;
    const numAmount = parseFloat(amount);

    // Check balance
    const user = await User.findById(req.user._id);
    if (user.balances.main < numAmount) {
      return res.status(402).json({
        status: 'fail',
        message: `Insufficient main balance. Available: $${user.balances.main.toFixed(2)}, Requested: $${numAmount.toFixed(2)}`,
      });
    }

    // Use mongoose session to debit + create request atomically
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Debit balance immediately (held in escrow until processed)
      await debitBalance({
        userId: user._id,
        amount: numAmount,
        balanceType: 'main',
        type: 'withdrawal',
        note: `Withdrawal via ${paymentMethod} to ${destinationAddress}`,
        session,
      });

      const request = await PaymentRequest.create(
        [{
          user: req.user._id,
          type: 'withdrawal',
          balanceTarget: 'main',
          amount: numAmount,
          paymentMethod,
          destinationAddress,
          destinationNote: destinationNote || null,
          status: 'pending',
        }],
        { session }
      );

      await session.commitTransaction();

      res.status(201).json({
        status: 'success',
        message: `Withdrawal of $${numAmount.toFixed(2)} submitted. It will be processed within 24 hours.`,
        data: { request: request[0] },
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  })
);

// ─── GET /api/v1/payments/my ──────────────────────────────────────────────────
router.get('/my', protect, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;
  const filter = { user: req.user._id };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;

  const [requests, total] = await Promise.all([
    PaymentRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PaymentRequest.countDocuments(filter),
  ]);

  res.json({
    status: 'success',
    data: { requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
  });
}));

// ─── GET /api/v1/payments/admin/pending (Admin only) ────────────────────────
router.get('/admin/pending', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const type = req.query.type; // 'deposit' | 'withdrawal' | undefined
  const filter = { status: 'pending' };
  if (type) filter.type = type;

  const requests = await PaymentRequest.find(filter)
    .populate('user', 'username email balances')
    .sort({ createdAt: 1 }); // oldest first for FIFO processing

  res.json({
    status: 'success',
    data: { requests, total: requests.length },
  });
}));

// ─── PATCH /api/v1/payments/admin/:id (Admin approve/reject) ─────────────────
router.patch(
  '/admin/:id',
  protect,
  restrictTo('admin'),
  [
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    body('adminNote').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { action, adminNote } = req.body;
    const payReq = await PaymentRequest.findById(req.params.id).populate('user');
    if (!payReq) {
      return res.status(404).json({ status: 'fail', message: 'Payment request not found.' });
    }
    if (payReq.status !== 'pending') {
      return res.status(400).json({ status: 'fail', message: `Request already ${payReq.status}.` });
    }

    if (action === 'approve') {
      if (payReq.type === 'deposit') {
        // Credit user balance on deposit approval
        await creditBalance({
          userId: payReq.user._id,
          amount: payReq.amount,
          balanceType: payReq.balanceTarget,
          type: 'deposit',
          note: `${payReq.paymentMethod} deposit approved (TXID: ${payReq.txid || 'N/A'})`,
        });
      }
      // For withdrawal: balance was already debited at request creation
      payReq.status = 'completed';
    } else {
      // Reject: refund withdrawal, or just mark deposit rejected
      if (payReq.type === 'withdrawal') {
        // Refund the held amount
        await creditBalance({
          userId: payReq.user._id,
          amount: payReq.amount,
          balanceType: 'main',
          type: 'refund',
          note: `Withdrawal rejected: ${adminNote || 'Insufficient details or duplicate'}`,
        });
      }
      payReq.status = 'rejected';
    }

    payReq.adminNote = adminNote || null;
    payReq.processedBy = req.user._id;
    payReq.processedAt = new Date();
    await payReq.save();

    res.json({
      status: 'success',
      message: `Payment request ${action}d.`,
      data: { request: payReq },
    });
  })
);

module.exports = router;
