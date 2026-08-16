require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const { hashPassword } = require('../utils/password');

async function addPatient() {
  const name = 'Jatin Gour';
  const email = 'jatingour@gmail.com';
  const phone = '9876543210';
  const password = 'jatin@1234';

  // Check whether this email already exists
  const existingUser = await User.findOne({
    email: email.toLowerCase()
  });

  if (existingUser) {
    console.log(`User with email ${email} already exists.`);
    return;
  }

  // Hash password using the application's existing password system
  const passwordHash = hashPassword(password);

  const patient = await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    role: 'patient',
    passwordHash
  });

  console.log('New patient created successfully.');
  console.log('Name:', patient.name);
  console.log('Email:', patient.email);
  console.log('Phone:', patient.phone);
  console.log('Role:', patient.role);
  console.log('Password:', password);
}

(async () => {
  try {
    await connectDB();
    await addPatient();
  } catch (error) {
    console.error('Failed to create patient:', error.message);
    process.exitCode = 1;
  } finally {
    const mongoose = require('mongoose');

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
})();