// src/models/PaymentRequest.js
/**
 * PaymentRequest — Deposit or Withdrawal requests with crypto payment support.
 */
const mongoose = require('mongoose');

const CRYPTO_NETWORKS = ['USDT_TRC20', 'USDT_BEP20', 'BTC', 'LTC', 'SOL', 'bank_card', 'payeer', 'qiwi', 'paypal', 'other'];

const PaymentRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal'],
      required: true,
      index: true,
    },
    // What balance is affected
    balanceTarget: {
      type: String,
      enum: ['main', 'ad'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.5, 'Minimum amount is $0.50'],
    },
    currency: {
      type: String,
      default: 'USD',
    },
    paymentMethod: {
      type: String,
      enum: CRYPTO_NETWORKS,
      required: true,
    },
    // Crypto deposit fields
    txid: { type: String, default: null, trim: true },  // Transaction hash submitted by user
    networkAddress: { type: String, default: null },     // Platform receiving address
    // Withdrawal destination
    destinationAddress: { type: String, default: null, trim: true },
    destinationNote: { type: String, default: null },   // Memo/tag if needed

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String, default: null },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

PaymentRequestSchema.index({ user: 1, type: 1, status: 1 });
PaymentRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PaymentRequest', PaymentRequestSchema);
