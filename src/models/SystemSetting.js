// src/models/SystemSetting.js
const mongoose = require('mongoose');

const SystemSettingSchema = new mongoose.Schema(
  {
    platformFeePercent: {
      type: Number,
      default: 25,
      min: 0,
      max: 90,
    },
    referralCommissionPercent: {
      type: Number,
      default: 5,
      min: 0,
      max: 50,
    },
    minDeposit: {
      type: Number,
      default: 1.0,
      min: 0.1,
    },
    minWithdrawal: {
      type: Number,
      default: 1.0,
      min: 0.1,
    },
    minPayoutPerTask: {
      type: Number,
      default: 0.001,
      min: 0.0001,
    },
    autoApproveHours: {
      type: Number,
      default: 48,
      min: 1,
      max: 720,
    },
    autoApproveEnabled: {
      type: Boolean,
      default: true,
    },
    antiCheatEnabled: {
      type: Boolean,
      default: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    nowPaymentsApiKey: {
      type: String,
      default: '',
    },
    nowPaymentsIpnSecret: {
      type: String,
      default: '',
    },
    coinPaymentsMerchantId: {
      type: String,
      default: '',
    },
    coinPaymentsIpnSecret: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// In-memory cache for ultra-fast access without repeated DB hits
let cachedSettings = null;
let cacheExpiry = 0;

SystemSettingSchema.statics.getSettings = async function () {
  const now = Date.now();
  if (cachedSettings && cacheExpiry > now) {
    return cachedSettings;
  }

  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }

  cachedSettings = settings.toObject();
  cacheExpiry = now + 10000; // Cache for 10 seconds
  return cachedSettings;
};

SystemSettingSchema.statics.updateSettings = async function (updates) {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this(updates);
  } else {
    Object.assign(settings, updates);
  }
  await settings.save();
  cachedSettings = settings.toObject();
  cacheExpiry = Date.now() + 10000;
  return cachedSettings;
};

module.exports = mongoose.model('SystemSetting', SystemSettingSchema);
