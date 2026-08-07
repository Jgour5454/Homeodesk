const jwt = require('jsonwebtoken');
const { findById } = require('../utils/userStore');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';

/**
 * requireAuth
 * Verifies the Bearer token and attaches the authenticated user (without the
 * password hash) to req.user. Rejects with 401 if missing/invalid/expired,
 * or if the account it points to no longer exists.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findById(payload.sub);
    if (!user) return res.status(401).json({ ok: false, error: 'User no longer exists.' });
    const { passwordHash, ...safeUser } = user;
    req.user = safeUser;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token.' });
  }
}

/**
 * requireRole('doctor')
 * Must run after requireAuth. Rejects with 403 if the authenticated user
 * doesn't have the required role — e.g. keeps patients out of doctor-only
 * write actions (confirming appointments, adding notes, cancelling on the
 * clinic's behalf) even if they guess the right URL.
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ ok: false, error: 'You do not have permission to do that.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
