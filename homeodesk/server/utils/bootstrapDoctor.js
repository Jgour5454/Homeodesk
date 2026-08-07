const { findByEmail, createUser, normalizeEmail } = require('./userStore');
const { hashPassword } = require('./password');
const { isValidDoctorEmail } = require('./validate');
const JsonStore = require('./jsonStore');

const usersStore = new JsonStore('users.json');

/**
 * Ensures the clinic's doctor account exists and its password matches
 * DOCTOR_PASSWORD in .env — every time the server starts.
 *
 * Why this exists: `npm run seed:doctor` is an *interactive* script (it
 * prompts for a password), which is fine on your own machine but breaks on
 * most hosting platforms — and on platforms with an ephemeral filesystem
 * (Render, Railway, Vercel, etc. on their free/default tiers), `data/*.json`
 * gets wiped on every redeploy/restart, so the doctor account you seeded
 * disappears and login stops working until you SSH in and re-run the
 * script by hand. This runs automatically on boot instead, so as long as
 * DOCTOR_EMAIL / DOCTOR_PASSWORD are set once in your environment (which
 * DOES persist across redeploys on every host), the doctor account is
 * always there — no manual step, ever again.
 *
 * If DOCTOR_PASSWORD is not set, this does nothing and the old manual
 * `npm run seed:doctor` flow still works exactly as before.
 */
function bootstrapDoctor() {
  const email = normalizeEmail(process.env.DOCTOR_EMAIL || '');
  const password = process.env.DOCTOR_PASSWORD || '';
  const name = process.env.DOCTOR_NAME || 'Dr. Isha Khimani';

  if (!email && !password) {
    // Not configured — fall back to the old manual `npm run seed:doctor` flow.
    return;
  }

  if (!isValidDoctorEmail(email)) {
    console.warn(`⚠️  DOCTOR_EMAIL ("${email}") doesn't look like a valid @doctor.in address — skipping auto-seed.`);
    return;
  }
  if (password.length < 8) {
    console.warn('⚠️  DOCTOR_PASSWORD must be at least 8 characters — skipping auto-seed.');
    return;
  }

  const passwordHash = hashPassword(password);
  const existing = findByEmail(email);

  if (existing) {
    const all = usersStore.findAll();
    const idx = all.findIndex((u) => u.id === existing.id);
    all[idx] = { ...existing, name, passwordHash, role: 'doctor' };
    usersStore._writeAll(all); // eslint-disable-line no-underscore-dangle
    console.log(`✔ Doctor account (${email}) confirmed and password synced from .env.`);
  } else {
    createUser({
      id: '1', // matches the doctor row in data/doctors.json used for appointment/consultation lookups
      name,
      email,
      phone: '',
      role: 'doctor',
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    console.log(`✔ Doctor account (${email}) created automatically from .env.`);
  }
}

module.exports = { bootstrapDoctor };
