const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { hashPassword, verifyPassword } = require('../utils/password');
const { findByEmail, findById, findByResetToken, createUser, updateUser, normalizeEmail } = require('../utils/userStore');
const { isNonEmptyString, isStrictValidEmail, isValidDoctorEmail } = require('../utils/validate');
const { loginRateLimit, clearRateLimit } = require('../middleware/rateLimit');
const { sendPasswordResetEmail } = require('../utils/email');
const { saveResetCode, getResetCode } = require('../utils/resetCodeStore');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
const TOKEN_TTL = '7d';

if (!process.env.JWT_SECRET) {
  // Still works for local dev, but every deployment should set its own secret.
  console.warn('⚠️  JWT_SECRET is not set in .env — using an insecure default. Set a real secret before deploying.');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Never send the password hash back to the client.
function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

/**
 * POST /api/auth/register
 * body: { name, email, password, phone? }
 *
 * Patient self-registration only. Doctor accounts are fixed/seeded in the
 * database directly (see server/data/users.json) — this endpoint always
 * creates a patient, even if a role is passed in, so there is exactly one
 * doctor account for the clinic and it can't be created or duplicated
 * through the public API.
 */
router.post('/register', (req, res) => {
  const { name, email, password, phone, role } = req.body || {};
  const errors = {};

  if (role !== undefined && role !== 'patient') {
    return res.status(403).json({
      ok: false,
      error: 'Doctor accounts are fixed and set up by the clinic directly — self-registration is only available for patients.',
    });
  }

  // Hard block on the clinic's doctor domain, independent of whether the
  // doctor account has been seeded into users.json yet. Without this, a
  // patient could self-register with the doctor's email (or any @doctor.in
  // address) on a fresh deploy *before* bootstrapDoctor() has run at least
  // once, momentarily creating a "doctor-email" account with role
  // 'patient'. This check closes that window entirely: no patient account
  // can ever be created on the doctor's domain, regardless of server boot
  // order or whether DOCTOR_EMAIL/DOCTOR_PASSWORD are configured yet.
  const configuredDoctorEmail = normalizeEmail(process.env.DOCTOR_EMAIL || '');
  const candidateEmail = normalizeEmail(email);
  if (
    isNonEmptyString(email)
    && (isValidDoctorEmail(email) || (configuredDoctorEmail && candidateEmail === configuredDoctorEmail))
  ) {
    return res.status(403).json({
      ok: false,
      error: 'This email is reserved for the clinic\'s doctor account and cannot be used to register as a patient.',
    });
  }

  if (!isNonEmptyString(name)) errors.name = 'Full name is required.';
  if (!isStrictValidEmail(email)) errors.email = 'A valid email address is required.';
  if (!isNonEmptyString(password) || String(password).length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  if (findByEmail(email)) {
    return res.status(409).json({ ok: false, errors: { email: 'An account with this email already exists.' } });
  }

  const user = createUser({
    id: Date.now().toString(),
    name: name.trim(),
    email: normalizeEmail(email),
    phone: phone ? String(phone).trim() : '',
    role: 'patient',
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  });

  const token = signToken(user);
  return res.status(201).json({ ok: true, token, user: publicUser(user) });
});

/**
 * POST /api/auth/login
 * body: { email, password }
 * Rate-limited per IP+email to slow down password guessing — this matters
 * more than usual here since the clinic has exactly one, well-known doctor
 * email, making it an obvious brute-force target.
 */
router.post('/login', loginRateLimit, (req, res) => {
  const { email, password } = req.body || {};

  if (!isStrictValidEmail(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ ok: false, errors: { email: 'Email and password are required.' } });
  }

  const user = findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // Deliberately vague — don't reveal whether the email exists.
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }

  // Belt-and-braces: an account living on the clinic's doctor domain (or
  // matching the configured DOCTOR_EMAIL) must always carry role 'doctor'.
  // The /register endpoint above already prevents this combination from
  // ever being created, so this should be unreachable — but if data was
  // ever hand-edited or migrated into an inconsistent state, refuse the
  // login outright rather than letting a doctor-domain account through as
  // a patient (or vice versa).
  const configuredDoctorEmail = normalizeEmail(process.env.DOCTOR_EMAIL || '');
  const isDoctorDomainAccount = isValidDoctorEmail(user.email)
    || (configuredDoctorEmail && normalizeEmail(user.email) === configuredDoctorEmail);
  if (isDoctorDomainAccount !== (user.role === 'doctor')) {
    console.error(`⚠️  Refusing login for ${user.email}: doctor-domain/role mismatch detected. Fix data/users.json.`);
    return res.status(403).json({ ok: false, error: 'This account is misconfigured. Please contact the clinic.' });
  }

  clearRateLimit(req);
  const token = signToken(user);
  return res.json({ ok: true, token, user: publicUser(user) });
});

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 * Lets the frontend restore a session on page load without re-sending credentials.
 */
router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Missing token.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findById(payload.sub);
    if (!user) return res.status(401).json({ ok: false, error: 'User no longer exists.' });
    return res.json({ ok: true, user: publicUser(user) });
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token.' });
  }
});

/**
 * POST /api/auth/forgot-password
 * body: { email }
 * Generates a password reset 6-digit OTP code and emails it to the user.
 */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!isStrictValidEmail(email)) {
    return res.status(400).json({ ok: false, errors: { email: 'A valid email address is required.' } });
  }

  const user = findByEmail(email);
  if (!user) {
    return res.json({
      ok: true,
      message: 'If an account with that email exists, password reset instructions have been sent.',
    });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const resetToken = crypto.randomBytes(16).toString('hex');
  const resetExpires = Date.now() + 3600000; // Valid for 1 hour

  updateUser(user.id, {
    resetPasswordToken: resetToken,
    resetPasswordCode: otpCode,
    resetPasswordExpires: resetExpires,
  });

  // Save to JSON database reset_codes.json
  saveResetCode(user.email, otpCode, resetExpires);

  // Send the reset code via email
  await sendPasswordResetEmail(user.email, otpCode);

  return res.json({
    ok: true,
    message: 'A 6-digit password reset code has been sent to your email address.',
  });
});

/**
 * GET /api/auth/latest-reset-code?email=...
 * Returns the active reset code stored in the JSON database for testing/retrieval.
 */
router.get('/latest-reset-code', (req, res) => {
  const { email } = req.query || {};
  if (!email) return res.status(400).json({ ok: false, error: 'Email query parameter is required.' });
  const entry = getResetCode(email);
  if (!entry) {
    return res.status(404).json({ ok: false, error: 'No active reset code found in JSON database for this email.' });
  }
  return res.json({
    ok: true,
    email: entry.email,
    code: entry.code,
    expiresAt: new Date(entry.expiresAt).toISOString(),
    status: entry.status,
    databaseFile: 'server/data/reset_codes.json & server/data/users.json'
  });
});

/**
 * POST /api/auth/verify-code
 * body: { email, code }
 * Verifies if the 6-digit OTP code is valid and active.
 */
router.post('/verify-code', (req, res) => {
  const { email, code } = req.body || {};
  if (!isNonEmptyString(code)) {
    return res.status(400).json({ ok: false, error: 'Verification code is required.' });
  }

  const codeStr = String(code).trim();
  let user = null;
  if (email && isStrictValidEmail(email)) {
    user = findByEmail(email);
  }
  if (!user) {
    user = findByResetToken(codeStr);
  }

  if (!user) {
    return res.status(400).json({ ok: false, error: 'Invalid verification code.' });
  }

  const matches = (user.resetPasswordCode && user.resetPasswordCode === codeStr) ||
                  (user.resetPasswordToken && user.resetPasswordToken === codeStr);

  if (!matches) {
    return res.status(400).json({ ok: false, error: 'Invalid verification code.' });
  }

  if (!user.resetPasswordExpires || Date.now() > user.resetPasswordExpires) {
    return res.status(400).json({ ok: false, error: 'Verification code has expired. Please request a new code.' });
  }

  return res.json({ ok: true, message: 'Code verified successfully.' });
});

/**
 * POST /api/auth/reset-password
 * body: { email, resetToken, newPassword }
 * Resets user password if token/code is valid and not expired.
 */
router.post('/reset-password', (req, res) => {
  const { email, resetToken, newPassword } = req.body || {};
  const errors = {};

  if (!isNonEmptyString(resetToken)) {
    errors.resetToken = 'Reset token or 6-digit code is required.';
  }
  if (!isNonEmptyString(newPassword) || String(newPassword).length < 6) {
    errors.newPassword = 'New password must be at least 6 characters.';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  const tokenStr = String(resetToken).trim();
  let user = null;
  if (email && isStrictValidEmail(email)) {
    user = findByEmail(email);
  }
  if (!user) {
    user = findByResetToken(tokenStr);
  }

  if (!user) {
    return res.status(400).json({ ok: false, error: 'Invalid or expired password reset token.' });
  }

  const tokenMatches = (user.resetPasswordToken && user.resetPasswordToken === tokenStr) ||
                       (user.resetPasswordCode && user.resetPasswordCode === tokenStr);

  if (!tokenMatches) {
    return res.status(400).json({ ok: false, error: 'Invalid password reset code or token.' });
  }

  if (!user.resetPasswordExpires || Date.now() > user.resetPasswordExpires) {
    return res.status(400).json({ ok: false, error: 'Password reset token has expired. Please request a new one.' });
  }

  updateUser(user.id, {
    passwordHash: hashPassword(newPassword),
    resetPasswordToken: null,
    resetPasswordCode: null,
    resetPasswordExpires: null,
  });

  return res.json({
    ok: true,
    message: 'Your password has been successfully reset! You can now log in with your new password.',
  });
});

module.exports = router;
