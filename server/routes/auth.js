const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const { isNonEmptyString, isStrictValidEmail, isValidDoctorEmail } = require('../utils/validate');
const { loginRateLimit, clearRateLimit } = require('../middleware/rateLimit');
const { sendPasswordResetEmail } = require('../utils/email');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '7d';
if (!JWT_SECRET) console.warn('JWT_SECRET is not configured. Authentication will fail until it is set.');

function signToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign({ sub: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function publicUser(user) {
  const obj = user.toObject({ virtuals: true });
  delete obj._id;
  delete obj.__v;
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordCode;
  delete obj.resetPasswordExpires;
  return obj;
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body || {};
    const errors = {};
    if (role !== undefined && role !== 'patient') return res.status(403).json({ ok: false, error: 'Doctor accounts cannot be created through public registration.' });
    if (!isNonEmptyString(name)) errors.name = 'Full name is required.';
    if (!isStrictValidEmail(email)) errors.email = 'A valid email address is required.';
    if (!isNonEmptyString(password) || String(password).length < 6) errors.password = 'Password must be at least 6 characters.';

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const doctorEmail = String(process.env.DOCTOR_EMAIL || '').trim().toLowerCase();
    if (normalizedEmail && (isValidDoctorEmail(normalizedEmail) || normalizedEmail === doctorEmail)) {
      return res.status(403).json({ ok: false, error: 'This email is reserved for the doctor account.' });
    }
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ ok: false, errors: { email: 'An account with this email already exists.' } });

    const user = await User.create({
      name: name.trim(), email: normalizedEmail, phone: String(phone || '').trim(), role: 'patient', passwordHash: hashPassword(password),
    });
    return res.status(201).json({ ok: true, token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) return res.status(409).json({ ok: false, errors: { email: 'An account with this email already exists.' } });
    return res.status(500).json({ ok: false, error: 'Registration failed.' });
  }
});

router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isStrictValidEmail(email) || !isNonEmptyString(password)) return res.status(400).json({ ok: false, errors: { email: 'Email and password are required.' } });
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ ok: false, error: 'Invalid email or password.' });

    const configuredDoctorEmail = String(process.env.DOCTOR_EMAIL || '').trim().toLowerCase();
    if ((normalizedEmail === configuredDoctorEmail || isValidDoctorEmail(user.email)) && user.role !== 'doctor') {
      return res.status(403).json({ ok: false, error: 'Doctor account is incorrectly configured.' });
    }
    clearRateLimit(req);
    return res.json({ ok: true, token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ ok: false, error: 'Login failed.' });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ ok: true, user: publicUser(req.user) }));

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!isStrictValidEmail(email)) return res.status(400).json({ ok: false, errors: { email: 'A valid email address is required.' } });
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.json({ ok: true, message: 'If an account with that email exists, password reset instructions have been sent.' });

    const code = crypto.randomInt(100000, 1000000).toString();
    user.resetPasswordToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordCode = code;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await sendPasswordResetEmail(user.email, code);
    return res.json({ ok: true, message: 'A 6-digit password reset code has been sent to your email address.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ ok: false, error: 'Unable to process password reset.' });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!isNonEmptyString(code)) return res.status(400).json({ ok: false, error: 'Verification code is required.' });
    const query = { resetPasswordCode: String(code).trim(), resetPasswordExpires: { $gt: new Date() } };
    if (email && isStrictValidEmail(email)) query.email = String(email).trim().toLowerCase();
    const user = await User.findOne(query);
    if (!user) return res.status(400).json({ ok: false, error: 'Invalid or expired verification code.' });
    return res.json({ ok: true, message: 'Code verified successfully.', resetToken: user.resetPasswordToken });
  } catch (err) {
    console.error('Verify code error:', err);
    return res.status(500).json({ ok: false, error: 'Unable to verify code.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body || {};
    const errors = {};
    if (!isNonEmptyString(resetToken)) errors.resetToken = 'Reset token or 6-digit code is required.';
    if (!isNonEmptyString(newPassword) || String(newPassword).length < 6) errors.newPassword = 'New password must be at least 6 characters.';
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

    const tokenStr = String(resetToken).trim();
    const conditions = [{ resetPasswordToken: tokenStr }, { resetPasswordCode: tokenStr }];
    const query = { $or: conditions, resetPasswordExpires: { $gt: new Date() } };
    if (email && isStrictValidEmail(email)) query.email = String(email).trim().toLowerCase();
    const user = await User.findOne(query);
    if (!user) return res.status(400).json({ ok: false, error: 'Invalid or expired password reset token.' });

    user.passwordHash = hashPassword(newPassword);
    user.resetPasswordToken = null;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    await user.save();
    return res.json({ ok: true, message: 'Your password has been successfully reset! You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ ok: false, error: 'Unable to reset password.' });
  }
});

module.exports = router;
