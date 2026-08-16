require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { hashPassword } = require('../utils/password');

(async () => {
  try {
    const email = String(process.env.DOCTOR_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.DOCTOR_PASSWORD || '');

    if (!email || !password) {
      throw new Error('DOCTOR_EMAIL and DOCTOR_PASSWORD must be configured.');
    }

    await connectDB();

    const doctor = await User.findOne({ email });

    if (!doctor) {
      throw new Error(`Doctor account not found: ${email}`);
    }

    doctor.passwordHash = hashPassword(password);
    doctor.role = 'doctor';

    await doctor.save();

    console.log(`Doctor password reset successfully for ${email}.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Password reset failed:', err.message);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
})();