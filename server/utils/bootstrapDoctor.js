const User = require('../models/User');
const { hashPassword } = require('./password');
const { isValidDoctorEmail } = require('./validate');

async function bootstrapDoctor() {
  const email = String(process.env.DOCTOR_EMAIL || '').trim().toLowerCase();
  const name = String(process.env.DOCTOR_NAME || 'Doctor').trim();
  const password = String(process.env.DOCTOR_PASSWORD || '');

  if (!email || !password) {
    throw new Error('DOCTOR_EMAIL and DOCTOR_PASSWORD must be configured.');
  }

  if (!isValidDoctorEmail(email)) {
    throw new Error('DOCTOR_EMAIL must use the @doctor.in domain.');
  }

  if (password.length < 8) {
    throw new Error('DOCTOR_PASSWORD must be at least 8 characters.');
  }

  let doctor = await User.findOne({ email });

  // Create the doctor only if the account does not already exist.
  // If the doctor was migrated from legacy JSON, preserve its existing
  // passwordHash instead of replacing it on every server startup.
  if (!doctor) {
    const passwordHash = hashPassword(password);

    doctor = await User.create({
      name,
      email,
      phone: '',
      role: 'doctor',
      passwordHash,
    });

    console.log(`Doctor account (${email}) created in MongoDB.`);
  } else {
    // Keep the existing passwordHash from MongoDB.
    doctor.name = name;
    doctor.role = 'doctor';

    await doctor.save();

    console.log(
      `Doctor account (${email}) found in MongoDB. Existing password hash preserved.`
    );
  }

  return doctor;
}

module.exports = bootstrapDoctor;