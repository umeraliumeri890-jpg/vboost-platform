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
const crypto = require('crypto');

const PaymentRequest = require('../models/PaymentRequest');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');
const { protect, restrictTo } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { creditBalance, debitBalance } = require('../services/ledger.service');
const { notifyUser } = require('../services/notification.service');
const { logAudit } = require('../services/audit.service');

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
      txid: txid.trim(),
      networkAddress: PLATFORM_ADDRESSES[paymentMethod] || null,
      status: 'pending',
    });

    res.status(201).json({
      status: 'success',
      message: 'Deposit request submitted! Awaiting Admin verification.',
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

// ─── POST /api/v1/payments/crypto-webhook (NOWPayments / CoinPayments Auto-Deposit) ──
router.post(
  '/crypto-webhook',
  asyncHandler(async (req, res) => {
    const settings = await SystemSetting.getSettings();
    const payload = req.body || {};

    // 1. Detect Gateway Type
    // NOWPayments format:
    // payload: { payment_id, payment_status, pay_amount, price_amount, order_id, actually_paid, outcome_amount }
    // Header: x-nowpayments-sig
    const nowPaySig = req.headers['x-nowpayments-sig'];
    const coinPayHmac = req.headers['hmac'] || req.headers['http_hmac'];

    let isSuccess = false;
    let externalTxid = payload.payment_id || payload.txn_id || payload.txid;
    let amount = parseFloat(payload.price_amount || payload.amount1 || payload.actually_paid || payload.amount || 0);
    let identifier = payload.order_id || payload.custom || payload.userId || payload.orderId;
    let paymentMethod = payload.pay_currency ? `CRYPTO_${String(payload.pay_currency).toUpperCase()}` : 'CRYPTO_WEBHOOK';

    if (nowPaySig && settings.nowPaymentsIpnSecret) {
      // NOWPayments HMAC-SHA512 verification
      const sortedKeys = Object.keys(payload).sort();
      const sortedObj = {};
      sortedKeys.forEach((key) => { sortedObj[key] = payload[key]; });
      const hmac = crypto.createHmac('sha512', settings.nowPaymentsIpnSecret);
      hmac.update(JSON.stringify(sortedObj));
      const calculatedSig = hmac.digest('hex');
      if (calculatedSig !== nowPaySig) {
        return res.status(401).json({ status: 'fail', message: 'Invalid NOWPayments signature.' });
      }
    }

    if (['finished', 'confirmed', 'completed'].includes(payload.payment_status?.toLowerCase()) ||
        payload.status === '100' || payload.status === 100 || payload.status === '2' || payload.status === 2 ||
        payload.event === 'payment.finished' || payload.status === 'completed') {
      isSuccess = true;
    }

    if (!isSuccess) {
      return res.status(200).json({ status: 'ok', message: `Webhook received with non-final status: ${payload.payment_status || payload.status}` });
    }

    if (!externalTxid) {
      externalTxid = `AUTO_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    // Locate matching PaymentRequest or User
    let payReq = null;
    if (identifier && mongoose.Types.ObjectId.isValid(identifier)) {
      payReq = await PaymentRequest.findById(identifier).populate('user');
    }
    if (!payReq && externalTxid) {
      payReq = await PaymentRequest.findOne({ txid: String(externalTxid).trim() }).populate('user');
    }

    let targetUser = payReq?.user;
    if (!targetUser && identifier) {
      targetUser = await User.findOne({
        $or: [
          ...(mongoose.Types.ObjectId.isValid(identifier) ? [{ _id: identifier }] : []),
          { username: identifier },
          { email: identifier },
        ],
      });
    }

    if (!targetUser) {
      return res.status(404).json({ status: 'fail', message: 'Unable to locate user for this payment callback.' });
    }

    const depositAmount = payReq?.amount || amount;
    if (depositAmount <= 0) {
      return res.status(400).json({ status: 'fail', message: 'Invalid deposit amount received.' });
    }

    // Avoid double credit if already completed
    if (payReq && payReq.status === 'completed') {
      return res.status(200).json({ status: 'ok', message: 'Payment already processed and credited.' });
    }

    // Automated credit to user's Ad Balance
    const balanceTarget = payReq?.balanceTarget || 'ad';
    await creditBalance({
      userId: targetUser._id,
      amount: depositAmount,
      balanceType: balanceTarget,
      type: 'deposit',
      note: `Automated Crypto Deposit (${paymentMethod}) — Confirmed`,
    });

    if (payReq) {
      payReq.status = 'completed';
      payReq.processedAt = new Date();
      payReq.adminNote = 'Auto-approved via Crypto Gateway Webhook';
      await payReq.save();
    } else {
      await PaymentRequest.create({
        user: targetUser._id,
        type: 'deposit',
        balanceTarget,
        amount: depositAmount,
        paymentMethod,
        txid: String(externalTxid),
        status: 'completed',
        adminNote: 'Auto-approved via Crypto Gateway Webhook',
        processedAt: new Date(),
      });
    }

    // Automated Referral Commission on Deposit
    const refPercent = settings.referralCommissionPercent ?? 5;
    if (targetUser.referredBy && refPercent > 0) {
      const refBonus = parseFloat(((depositAmount * refPercent) / 100).toFixed(4));
      if (refBonus > 0) {
        await creditBalance({
          userId: targetUser.referredBy,
          amount: refBonus,
          balanceType: 'main',
          type: 'referral_bonus',
          note: `Referral commission (${refPercent}%) from deposit by @${targetUser.username}`,
        });
        await User.findByIdAndUpdate(targetUser.referredBy, { $inc: { referralEarnings: refBonus } });
        notifyUser({
          userId: targetUser.referredBy,
          title: '💰 Referral Deposit Bonus Received!',
          message: `You received a $${refBonus.toFixed(2)} referral bonus (${refPercent}%) from @${targetUser.username}'s deposit!`,
          type: 'referral',
        }).catch(() => {});
      }
    }

    // In-app notification to depositor
    notifyUser({
      userId: targetUser._id,
      title: '💰 Crypto Deposit Confirmed!',
      message: `$${depositAmount.toFixed(2)} has been automatically credited to your ${balanceTarget.toUpperCase()} Balance!`,
      type: 'deposit',
    }).catch(() => {});

    // Audit log
    logAudit({
      action: 'CRYPTO_AUTO_DEPOSIT_WEBHOOK',
      performedBy: targetUser._id,
      targetUser: targetUser._id,
      details: { amount: depositAmount, txid: externalTxid, method: paymentMethod },
      ip: req.ip,
    }).catch(() => {});

    res.status(200).json({
      status: 'success',
      message: 'Deposit verified and user balance credited automatically.',
    });
  })
);

// ─── PATCH /api/v1/payments/admin/approve-deposit/:id ────────────────────────
// Balance increment ONLY executes upon explicit manual Admin approval
const handleApproveDeposit = asyncHandler(async (req, res) => {
  const payReq = await PaymentRequest.findById(req.params.id).populate('user');
  if (!payReq) {
    return res.status(404).json({ status: 'fail', message: 'Deposit request not found.' });
  }
  if (payReq.type !== 'deposit') {
    return res.status(400).json({ status: 'fail', message: 'Request is not a deposit.' });
  }
  if (payReq.status !== 'pending') {
    return res.status(400).json({ status: 'fail', message: `Deposit request is already ${payReq.status}.` });
  }

  // Execute balance increment ONLY now upon Admin approval
  const { user: updatedUser } = await creditBalance({
    userId: payReq.user._id,
    amount: payReq.amount,
    balanceType: payReq.balanceTarget || 'ad',
    type: 'deposit',
    note: `${payReq.paymentMethod} deposit approved (TXID: ${payReq.txid || 'N/A'})`,
  });

  payReq.status = 'completed';
  payReq.processedBy = req.user._id;
  payReq.processedAt = new Date();
  payReq.adminNote = req.body.adminNote || 'Approved by Admin';
  await payReq.save();

  // Automated Referral Commission on approved deposit
  const settings = await SystemSetting.getSettings();
  const refPercent = settings.referralCommissionPercent ?? 5;
  if (payReq.user.referredBy && refPercent > 0) {
    const refBonus = parseFloat(((payReq.amount * refPercent) / 100).toFixed(4));
    if (refBonus > 0) {
      await creditBalance({
        userId: payReq.user.referredBy,
        amount: refBonus,
        balanceType: 'main',
        type: 'referral_bonus',
        note: `Referral commission (${refPercent}%) from deposit by @${payReq.user.username}`,
      });
      await User.findByIdAndUpdate(payReq.user.referredBy, { $inc: { referralEarnings: refBonus } });
      notifyUser({
        userId: payReq.user.referredBy,
        title: '💰 Referral Deposit Bonus!',
        message: `You received a $${refBonus.toFixed(2)} referral bonus (${refPercent}%) from @${payReq.user.username}'s deposit!`,
        type: 'referral',
      }).catch(() => {});
    }
  }

  // User notification
  notifyUser({
    userId: payReq.user._id,
    title: '✅ Deposit Request Approved',
    message: `Your deposit of $${payReq.amount.toFixed(2)} (${payReq.paymentMethod}) was approved and credited to your Ad Balance!`,
    type: 'deposit',
  }).catch(() => {});

  // Audit log
  logAudit({
    action: 'DEPOSIT_APPROVE',
    performedBy: req.user._id,
    targetUser: payReq.user._id,
    details: { amount: payReq.amount, txid: payReq.txid, method: payReq.paymentMethod, note: payReq.adminNote },
    ip: req.clientIp || req.ip,
  }).catch(() => {});

  res.json({
    status: 'success',
    message: `Deposit of $${payReq.amount.toFixed(2)} approved! User ${payReq.user.username} balance updated.`,
    data: {
      request: payReq,
      userBalances: updatedUser?.balances,
    },
  });
});

router.patch('/admin/approve-deposit/:id', protect, restrictTo('admin'), handleApproveDeposit);
router.post('/admin/approve-deposit/:id', protect, restrictTo('admin'), handleApproveDeposit);

// ─── PATCH /api/v1/payments/admin/reject-deposit/:id ─────────────────────────
// Rejects deposit request — User balance remains unchanged
const handleRejectDeposit = asyncHandler(async (req, res) => {
  const payReq = await PaymentRequest.findById(req.params.id).populate('user');
  if (!payReq) {
    return res.status(404).json({ status: 'fail', message: 'Deposit request not found.' });
  }
  if (payReq.type !== 'deposit') {
    return res.status(400).json({ status: 'fail', message: 'Request is not a deposit.' });
  }
  if (payReq.status !== 'pending') {
    return res.status(400).json({ status: 'fail', message: `Deposit request is already ${payReq.status}.` });
  }

  payReq.status = 'rejected';
  payReq.processedBy = req.user._id;
  payReq.processedAt = new Date();
  payReq.adminNote = req.body.adminNote || req.body.reason || 'Rejected by Admin';
  await payReq.save();

  // User notification
  notifyUser({
    userId: payReq.user._id,
    title: '❌ Deposit Request Rejected',
    message: `Your deposit request of $${payReq.amount.toFixed(2)} was rejected. Reason: ${payReq.adminNote}`,
    type: 'deposit',
  }).catch(() => {});

  // Audit log
  logAudit({
    action: 'DEPOSIT_REJECT',
    performedBy: req.user._id,
    targetUser: payReq.user._id,
    details: { amount: payReq.amount, txid: payReq.txid, reason: payReq.adminNote },
    ip: req.clientIp || req.ip,
  }).catch(() => {});

  res.json({
    status: 'success',
    message: 'Deposit request rejected. User balance remains unchanged.',
    data: { request: payReq },
  });
});

router.patch('/admin/reject-deposit/:id', protect, restrictTo('admin'), handleRejectDeposit);
router.post('/admin/reject-deposit/:id', protect, restrictTo('admin'), handleRejectDeposit);

module.exports = router;
