/**
 * Creates (or resets the password for) the clinic's single, fixed doctor
 * account. Doctor accounts are never created through the public API — this
 * script is the only way to set one up, so the password never travels
 * through a browser request and never lives in the frontend bundle.
 *
 * Usage:
 *   node scripts/seedDoctor.js "ishakhimani45@doctor.in" "Dr. Isha Khimani"
 *
 * You'll be prompted for a password (input is hidden). The password is
 * hashed with scrypt before it touches disk — data/users.json never stores
 * it in plain text.
 */
const readline = require('readline');
const { findByEmail, createUser, normalizeEmail } = require('../utils/userStore');
const { hashPassword } = require('../utils/password');
const { isValidDoctorEmail } = require('../utils/validate');
const JsonStore = require('../utils/jsonStore');

const usersStore = new JsonStore('users.json');

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Hide typed characters so the password doesn't end up in shell history/logs.
    const onData = (char) => {
      char = char.toString('utf8');
      if (char === '\n' || char === '\r' || char === '\u0004') return;
      process.stdout.write('\x1b[2K\x1b[200D' + question + '*'.repeat(rl.line.length));
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const [, , emailArg, ...nameParts] = process.argv;
  const email = normalizeEmail(emailArg || 'ishakhimani45@doctor.in');
  const name = nameParts.join(' ') || 'Dr. Isha Khimani';

  if (!isValidDoctorEmail(email)) {
    console.error(`✖ "${email}" doesn't look like a valid @doctor.in address.`);
    process.exit(1);
  }

  const password = await promptHidden('Set a password for this doctor account: ');
  if (!password || password.length < 8) {
    console.error('✖ Password must be at least 8 characters.');
    process.exit(1);
  }
  const confirm = await promptHidden('Confirm password: ');
  if (password !== confirm) {
    console.error('✖ Passwords did not match.');
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  const existing = findByEmail(email);

  if (existing) {
    const all = usersStore.findAll();
    const idx = all.findIndex((u) => u.id === existing.id);
    all[idx] = { ...existing, name, passwordHash, role: 'doctor' };
    usersStore._writeAll(all); // eslint-disable-line no-underscore-dangle
    console.log(`✔ Password updated for existing doctor account (${email}).`);
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
    console.log(`✔ Doctor account created (${email}).`);
  }
}

main().catch((err) => {
  console.error('Failed to seed doctor account:', err);
  process.exit(1);
});
