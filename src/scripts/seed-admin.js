#!/usr/bin/env node
// src/scripts/seed-admin.js
/**
 * Dedicated Admin Account Seeder
 *
 * Credentials:
 *   Email:    admin@vboost.com
 *   Password: AdminPassword123!
 *   Role:     'admin'
 *   Roles:    ['admin', 'worker', 'advertiser']
 *
 * Usage:
 *   node src/scripts/seed-admin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ADMIN_EMAIL = 'admin@vboost.com';
const ADMIN_PASSWORD = 'AdminPassword123!';
const ADMIN_USERNAME = 'vboost_admin';

async function seedAdmin() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is missing.');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✔ Connected to MongoDB');

    let admin = await User.findOne({ email: ADMIN_EMAIL });
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);

    if (admin) {
      console.log(`ℹ Found existing account for ${ADMIN_EMAIL}. Updating credentials and roles...`);
      await User.updateOne(
        { _id: admin._id },
        {
          $set: {
            passwordHash,
            role: 'admin',
            roles: ['admin', 'worker', 'advertiser'],
            isActive: true,
            isBanned: false,
            isVerified: true,
          },
        }
      );
    } else {
      console.log(`ℹ Creating new dedicated admin account for ${ADMIN_EMAIL}...`);
      const existingUsername = await User.findOne({ username: ADMIN_USERNAME });
      const finalUsername = existingUsername ? `admin_${Date.now().toString(36)}` : ADMIN_USERNAME;

      await User.collection.insertOne({
        username: finalUsername,
        email: ADMIN_EMAIL,
        passwordHash,
        role: 'admin',
        roles: ['admin', 'worker', 'advertiser'],
        balances: { main: 100.0, ad: 100.0 },
        gamification: { xp: 5000, level: 10, streakDays: 30, longestStreak: 30 },
        stats: { tasksCompleted: 0, tasksPending: 0, tasksRejected: 0, totalEarned: 0, totalSpent: 0, campaignsCreated: 0 },
        isVerified: true,
        isActive: true,
        isBanned: false,
        banReason: null,
        referralCode: 'vboost_admin_master',
        socialAccounts: {
          vk: null,
          instagram: null,
          youtube: null,
          tiktok: null,
          telegram: null,
          facebook: null,
          threads: null,
          twitter: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Verify password verification and roles
    const verifyUser = await User.findOne({ email: ADMIN_EMAIL }).select('+passwordHash');
    const isPasswordValid = await verifyUser.comparePassword(ADMIN_PASSWORD);

    if (!isPasswordValid) {
      throw new Error('Password verification test failed on newly seeded admin!');
    }

    console.log('✔ Password verification test passed (comparePassword matches).');
    console.log('\n=============================================');
    console.log('  DEDICATED ADMIN ACCOUNT READY');
    console.log('=============================================');
    console.log(`  Username: ${verifyUser.username}`);
    console.log(`  Email:    ${verifyUser.email}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  Role:     ${verifyUser.role}`);
    console.log(`  Roles:    [ ${verifyUser.roles.join(', ')} ]`);
    console.log('=============================================\n');
  } catch (error) {
    console.error('❌ Failed to seed admin:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin();
