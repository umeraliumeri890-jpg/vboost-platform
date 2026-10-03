#!/usr/bin/env node
// src/scripts/make-admin.js
/**
 * Promote a user to the 'admin' role.
 *
 * Usage:
 *   node src/scripts/make-admin.js <email>
 *
 * Example:
 *   node src/scripts/make-admin.js n437662@gmail.com
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
  console.error('\n❌  Usage: node src/scripts/make-admin.js <email>\n');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✔  Connected to MongoDB');

    // Find user first so we can show clear feedback
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      console.error(`\n❌  No user found with email: ${email}\n`);
      process.exit(1);
    }

    // Add 'admin' to the roles array (no duplicates)
    const result = await User.updateOne(
      { _id: user._id },
      { $addToSet: { roles: 'admin' } }
    );

    // Verify final state
    const updated = await User.findById(user._id).select('username email roles');

    if (result.modifiedCount === 0) {
      console.log(`\n⚠️   User "${updated.username}" (${email}) already has the 'admin' role.`);
    } else {
      console.log(`\n✅  Success! "${updated.username}" (${email}) has been promoted to admin.`);
    }

    console.log(`   Roles: [ ${updated.roles.join(', ')} ]\n`);
  } catch (err) {
    console.error('\n❌  Error:', err.message, '\n');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
