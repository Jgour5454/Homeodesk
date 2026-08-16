const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

function getToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

async function authenticate(req) {
  const token = getToken(req);
  if (!token) return null;
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured.');

  const payload = jwt.verify(token, JWT_SECRET);
  if (!payload.sub) return null;

  const user = await User.findById(payload.sub);
  if (!user) return null;
  return user;
}

async function requireAuth(req, res, next) {
  try {
    const user = await authenticate(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Authentication required.' });
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token.' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    req.user = await authenticate(req);
  } catch {
    req.user = null;
  }
  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ ok: false, error: 'You do not have permission to do that.' });
    }
    return next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
