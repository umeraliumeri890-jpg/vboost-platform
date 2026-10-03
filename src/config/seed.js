// src/config/seed.js
/**
 * Database Seed Script
 * Pre-populates the database with demo accounts (Worker & Advertiser),
 * active campaigns across various social platforms, and realistic initial balances.
 *
 * Run with: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Completion = require('../models/Completion');
const Transaction = require('../models/Transaction');
const connectDB = require('./database');
const logger = require('./logger');

const seedData = async () => {
  try {
    await connectDB();
    logger.info('Connected to MongoDB for seeding...');

    // Clear existing collections if desired (optional safeguard: only remove seed users)
    const existingAdmin = await User.findOne({ email: 'admin@microtask.com' });
    if (existingAdmin) {
      logger.info('Demo seed data already exists. Cleaning up demo accounts...');
      const demoUsers = await User.find({
        email: { $in: ['admin@microtask.com', 'advertiser@microtask.com', 'worker@microtask.com'] },
      });
      const demoUserIds = demoUsers.map((u) => u._id);
      await Campaign.deleteMany({ advertiser: { $in: demoUserIds } });
      await Completion.deleteMany({ worker: { $in: demoUserIds } });
      await Transaction.deleteMany({ user: { $in: demoUserIds } });
      await User.deleteMany({ _id: { $in: demoUserIds } });
    }

    // 1. Create Dedicated VBoost Admin
    const vboostAdmin = await User.findOne({ email: 'admin@vboost.com' });
    const adminSalt = await bcrypt.genSalt(12);
    const adminPassHash = await bcrypt.hash('AdminPassword123!', adminSalt);
    if (!vboostAdmin) {
      await User.collection.insertOne({
        username: 'vboost_admin',
        email: 'admin@vboost.com',
        passwordHash: adminPassHash,
        role: 'admin',
        roles: ['admin', 'worker', 'advertiser'],
        balances: { main: 100.0, ad: 100.0 },
        gamification: { xp: 5000, level: 10, streakDays: 30, longestStreak: 30 },
        stats: { tasksCompleted: 0, totalEarned: 0, totalSpent: 0, campaignsCreated: 0 },
        referralCode: 'admin_vboost_master',
        isVerified: true,
        isActive: true,
        isBanned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info('Dedicated admin created: admin@vboost.com');
    } else {
      await User.updateOne(
        { email: 'admin@vboost.com' },
        {
          $set: {
            passwordHash: adminPassHash,
            role: 'admin',
            roles: ['admin', 'worker', 'advertiser'],
            isActive: true,
            isBanned: false,
            isVerified: true,
          },
        }
      );
    }

    // 2. Create Demo Admin (pre-save hook in User model will hash passwordHash)
    const admin = await User.create({
      username: 'admin',
      email: 'admin@microtask.com',
      passwordHash: 'Password123!',
      role: 'admin',
      roles: ['admin', 'advertiser', 'worker'],
      balances: { main: 150.0, ad: 500.0 },
      gamification: { xp: 1200, level: 5, streakDays: 14, longestStreak: 14 },
      stats: { tasksCompleted: 120, totalEarned: 85.5, totalSpent: 250.0, campaignsCreated: 8 },
      referralCode: 'admin_ref_master',
      isVerified: true,
    });

    // 2. Create Demo Advertiser
    const advertiser = await User.create({
      username: 'apex_marketing',
      email: 'advertiser@microtask.com',
      passwordHash: 'Password123!',
      roles: ['advertiser', 'worker'],
      balances: { main: 25.0, ad: 250.0 },
      gamification: { xp: 350, level: 3, streakDays: 3, longestStreak: 5 },
      stats: { tasksCompleted: 15, totalEarned: 12.0, totalSpent: 450.0, campaignsCreated: 12 },
      referralCode: 'apex_promo',
      isVerified: true,
    });

    // 3. Create Demo Worker
    const worker = await User.create({
      username: 'pro_earner_99',
      email: 'worker@microtask.com',
      passwordHash: 'Password123!',
      roles: ['worker'],
      balances: { main: 48.75, ad: 0.0 },
      gamification: { xp: 680, level: 4, streakDays: 7, longestStreak: 12 },
      stats: { tasksCompleted: 68, tasksPending: 3, tasksRejected: 2, totalEarned: 48.75, totalSpent: 0, campaignsCreated: 0 },
      referralCode: 'pro_earner_ref',
      referredBy: admin._id,
      isVerified: true,
    });

    logger.info('Demo users created successfully:');
    logger.info('  Admin:      admin@microtask.com / Password123!');
    logger.info('  Advertiser: advertiser@microtask.com / Password123!');
    logger.info('  Worker:     worker@microtask.com / Password123!');

    // 4. Create Demo Campaigns
    const sampleCampaigns = [
      {
        advertiser: advertiser._id,
        title: 'Subscribe to TechPulse Official Channel',
        description: 'Subscribe to our YouTube channel and like the latest uploaded video.',
        category: 'youtube_subscribe',
        targetUrl: 'https://youtube.com/@techpulse_demo',
        instructions: '1. Visit the YouTube link.\n2. Click the Subscribe button.\n3. Like the latest video.\n4. Take a screenshot showing your subscription state.',
        proofType: 'screenshot',
        proofInstructions: 'Upload a screenshot showing the "Subscribed" button and like active.',
        payoutPerTask: 0.15,
        totalBudget: 30.0,
        spentBudget: 4.5,
        totalLimit: 200,
        completionsCount: 30,
        status: 'active',
        autoApprove: false,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'stratadefence',
        description: 'Follow @stratadefence on Instagram and view recent stories.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/stratadefence',
        instructions: '1. Open the Instagram page.\n2. Tap Follow.\n3. Like the pinned reel.\n4. Submit your Instagram handle as proof.',
        proofType: 'username',
        proofInstructions: 'Enter your exact Instagram username so we can verify via follower list.',
        payoutPerTask: 0.04, // Top task: $0.040 (~3.60 RUB / 0.400 scale)
        totalBudget: 40.0,
        spentBudget: 8.0,
        totalLimit: 1000,
        completionsCount: 215,
        status: 'active',
        autoApprove: true,
        autoApproveDelay: 60,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'zapobedu_kz',
        description: 'Follow @zapobedu_kz on Instagram.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/zapobedu_kz',
        instructions: '1. Open profile.\n2. Click Follow.\n3. Return and submit your handle.',
        proofType: 'username',
        payoutPerTask: 0.012,
        totalBudget: 10.0,
        spentBudget: 2.0,
        totalLimit: 500,
        completionsCount: 88,
        status: 'active',
        autoApprove: true,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'paulaner_uzb',
        description: 'Follow restaurant page @paulaner_uzb.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/paulaner_uzb',
        instructions: '1. Open the Instagram profile.\n2. Click Follow.\n3. Submit handle.',
        proofType: 'username',
        payoutPerTask: 0.018,
        totalBudget: 15.0,
        spentBudget: 3.5,
        totalLimit: 600,
        completionsCount: 140,
        status: 'active',
        autoApprove: true,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'liudarielt',
        description: 'Follow real estate account @liudarielt.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/liudarielt',
        instructions: '1. Click Follow on the Instagram page.\n2. Submit your username.',
        proofType: 'username',
        payoutPerTask: 0.018,
        totalBudget: 15.0,
        spentBudget: 1.8,
        totalLimit: 400,
        completionsCount: 65,
        status: 'active',
        autoApprove: true,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'dr.nona_ovsepyan',
        description: 'Follow medical specialist @dr.nona_ovsepyan.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/dr.nona_ovsepyan',
        instructions: '1. Tap Follow.\n2. Submit handle.',
        proofType: 'username',
        payoutPerTask: 0.015,
        totalBudget: 12.0,
        spentBudget: 2.2,
        totalLimit: 500,
        completionsCount: 120,
        status: 'active',
        autoApprove: true,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'pavon.kz',
        description: 'Follow regional news community @pavon.kz.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/pavon.kz',
        instructions: '1. Tap Follow.\n2. Submit handle.',
        proofType: 'username',
        payoutPerTask: 0.015,
        totalBudget: 10.0,
        spentBudget: 1.5,
        totalLimit: 400,
        completionsCount: 82,
        status: 'active',
        autoApprove: true,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'tahir__abdullayev',
        description: 'Follow creator @tahir__abdullayev.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/tahir__abdullayev',
        instructions: '1. Tap Follow.\n2. Submit handle.',
        proofType: 'username',
        payoutPerTask: 0.015,
        totalBudget: 10.0,
        spentBudget: 1.0,
        totalLimit: 350,
        completionsCount: 45,
        status: 'active',
        autoApprove: true,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'rammmmm.001',
        description: 'Follow account @rammmmm.001.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/rammmmm.001',
        instructions: '1. Tap Follow.\n2. Submit handle.',
        proofType: 'username',
        payoutPerTask: 0.015,
        totalBudget: 10.0,
        spentBudget: 0.9,
        totalLimit: 300,
        completionsCount: 38,
        status: 'active',
        autoApprove: true,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'jenskaya.obuv2818',
        description: 'Follow fashion store @jenskaya.obuv2818.',
        category: 'instagram_follow',
        targetUrl: 'https://instagram.com/jenskaya.obuv2818',
        instructions: '1. Tap Follow.\n2. Submit handle.',
        proofType: 'username',
        payoutPerTask: 0.015,
        totalBudget: 10.0,
        spentBudget: 0.6,
        totalLimit: 250,
        completionsCount: 22,
        status: 'active',
        autoApprove: true,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'Join Telegram VIP Signals & Announcements Channel',
        description: 'Join our public Telegram community and stay active.',
        category: 'telegram_join',
        targetUrl: 'https://t.me/cryptosignals_vip_demo',
        instructions: '1. Click the Telegram invite link.\n2. Join the channel.\n3. Provide your Telegram @username as proof.',
        proofType: 'username',
        proofInstructions: 'Your Telegram username including the @ symbol.',
        payoutPerTask: 0.10,
        totalBudget: 15.0,
        spentBudget: 2.0,
        totalLimit: 150,
        completionsCount: 20,
        status: 'active',
        autoApprove: false,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: admin._id,
        title: 'VKontakte: Join Community & Repost',
        description: 'Join our official VK group and repost the top pinned announcement to your wall.',
        category: 'vk_follow',
        targetUrl: 'https://vk.com/microtask_official_demo',
        instructions: '1. Follow the VK community link.\n2. Click "Join / Follow".\n3. Screenshot your VK profile showing the joined status.',
        proofType: 'screenshot',
        proofInstructions: 'Clear screenshot of the VK group page with "You are a member" visible.',
        payoutPerTask: 0.12,
        totalBudget: 25.0,
        spentBudget: 6.0,
        totalLimit: 208,
        completionsCount: 50,
        status: 'active',
        autoApprove: false,
        targeting: { minLevel: 1, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: admin._id,
        title: 'TikTok: Follow & Like 3 Latest Videos',
        description: 'Help boost our creator profile on TikTok with follows and likes.',
        category: 'tiktok_follow',
        targetUrl: 'https://tiktok.com/@growthvibes_demo',
        instructions: '1. Go to our TikTok profile.\n2. Click Follow.\n3. Like the top 3 videos.\n4. Screenshot the profile page with the "Following" button shown.',
        proofType: 'screenshot',
        proofInstructions: 'Screenshot showing following status.',
        payoutPerTask: 0.10,
        totalBudget: 18.0,
        spentBudget: 1.5,
        totalLimit: 180,
        completionsCount: 15,
        status: 'active',
        autoApprove: false,
        targeting: { minLevel: 2, maxCompletionsPerUser: 1, countries: [] },
      },
      {
        advertiser: advertiser._id,
        title: 'Google Maps 5-Star Honest Local Review',
        description: 'Leave an honest review for our digital agency on Google Maps.',
        category: 'google_review',
        targetUrl: 'https://maps.google.com/?q=digital_agency_demo',
        instructions: '1. Open the Google Maps link.\n2. Write a 2-3 sentence positive review.\n3. Take a screenshot right after submitting.',
        proofType: 'screenshot',
        proofInstructions: 'Screenshot of the review posted showing your Google account name.',
        payoutPerTask: 0.50,
        totalBudget: 50.0,
        spentBudget: 5.0,
        totalLimit: 100,
        completionsCount: 10,
        status: 'active',
        autoApprove: false,
        targeting: { minLevel: 2, maxCompletionsPerUser: 1, countries: [] },
      },
    ];

    const createdCampaigns = await Campaign.insertMany(sampleCampaigns);
    logger.info(`Inserted ${createdCampaigns.length} sample campaigns.`);

    // 5. Create Sample Completions for the Demo Worker
    const sampleCompletions = [
      {
        campaign: createdCampaigns[0]._id,
        worker: worker._id,
        payoutAmount: 0.15,
        proof: {
          type: 'screenshot',
          screenshotUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800',
          submittedAt: new Date(Date.now() - 3600000 * 2),
        },
        status: 'submitted',
        submissionDeadline: new Date(Date.now() + 3600000),
      },
      {
        campaign: createdCampaigns[1]._id,
        worker: worker._id,
        payoutAmount: 0.08,
        proof: {
          type: 'username',
          textContent: '@crypto_fan_pro',
          submittedAt: new Date(Date.now() - 3600000 * 5),
        },
        status: 'approved',
        paidAt: new Date(Date.now() - 3600000 * 4),
        xpAwarded: 10,
      },
    ];

    await Completion.insertMany(sampleCompletions);
    logger.info('Inserted demo completions.');

    logger.info('Database seeded successfully! You can now log in with the demo accounts.');
    process.exit(0);
  } catch (err) {
    logger.error('Seed script failed:', err);
    process.exit(1);
  }
};

seedData();
