// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * XP thresholds per level (cumulative)
 * Level 1: 0 XP | Level 2: 100 | Level 3: 300 | Level 4: 600 | Level 5: 1000 ...
 */
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3100, 4200, 5500];

const UserSchema = new mongoose.Schema(
  {
    // ─── Identity ───────────────────────────────────────────
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_]+$/,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },
    avatar: { type: String, default: null }, // URL to avatar image

    // ─── Dual Balance System ────────────────────────────────
    balances: {
      main: {
        type: Number,
        default: 0,
        min: 0,
        get: (v) => parseFloat(v.toFixed(4)),
      },
      ad: {
        type: Number,
        default: 0,
        min: 0,
        get: (v) => parseFloat(v.toFixed(4)),
      },
    },

    // ─── Gamification / XP System ──────────────────────────
    gamification: {
      xp: { type: Number, default: 0, min: 0 },
      level: { type: Number, default: 1, min: 1 },
      streakDays: { type: Number, default: 0 },
      lastActivityDate: { type: Date, default: null },
      longestStreak: { type: Number, default: 0 },
      badges: [{ type: String }],
    },

    // ─── Task Statistics ────────────────────────────────────
    stats: {
      tasksCompleted: { type: Number, default: 0 },
      tasksPending: { type: Number, default: 0 },
      tasksRejected: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 }, // as advertiser
      campaignsCreated: { type: Number, default: 0 },
    },

    // ─── Account Flags ──────────────────────────────────────
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    roles: {
      type: [String],
      enum: ['worker', 'advertiser', 'admin'],
      default: ['worker', 'advertiser'], // Both roles from one account
    },

    // ─── Security ───────────────────────────────────────────
    emailVerificationToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },

    // ─── Referral System ────────────────────────────────────
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referralEarnings: { type: Number, default: 0 },

    // ─── Linked Social Accounts ────────────────────────────
    socialAccounts: {
      vk: { type: String, default: null },
      instagram: { type: String, default: null },
      youtube: { type: String, default: null },
      tiktok: { type: String, default: null },
      telegram: { type: String, default: null },
      facebook: { type: String, default: null },
      threads: { type: String, default: null },
      twitter: { type: String, default: null },
    },

    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
UserSchema.index({ 'gamification.xp': -1 }); // Leaderboard
UserSchema.index({ createdAt: -1 });

// ─── Pre-save: Hash password ──────────────────────────────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

/**
 * Award XP and auto-level the user.
 * Returns { newXp, newLevel, leveledUp }
 */
UserSchema.methods.awardXP = function (amount) {
  this.gamification.xp += amount;
  const xp = this.gamification.xp;
  let newLevel = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      newLevel = i + 1;
      break;
    }
  }
  const leveledUp = newLevel > this.gamification.level;
  this.gamification.level = newLevel;
  return { newXp: xp, newLevel, leveledUp };
};

/**
 * Update streak — call once per day on task completion.
 */
UserSchema.methods.updateStreak = function () {
  const now = new Date();
  const last = this.gamification.lastActivityDate;

  if (!last) {
    this.gamification.streakDays = 1;
  } else {
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      this.gamification.streakDays += 1;
    } else if (diffDays > 1) {
      this.gamification.streakDays = 1; // Reset
    }
    // diffDays === 0 → same day, no change
  }

  if (this.gamification.streakDays > this.gamification.longestStreak) {
    this.gamification.longestStreak = this.gamification.streakDays;
  }
  this.gamification.lastActivityDate = now;
};

/**
 * Safe public profile (no sensitive fields).
 */
UserSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    username: this.username,
    avatar: this.avatar,
    level: this.gamification.level,
    xp: this.gamification.xp,
    badges: this.gamification.badges,
    streakDays: this.gamification.streakDays,
    tasksCompleted: this.stats.tasksCompleted,
    memberSince: this.createdAt,
  };
};

module.exports = mongoose.model('User', UserSchema);
