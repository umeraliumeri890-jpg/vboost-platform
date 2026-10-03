// src/models/BannedIp.js
const mongoose = require('mongoose');

const BannedIpSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      default: 'Multiple accounts / Fraud detection',
    },
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BannedIp', BannedIpSchema);
