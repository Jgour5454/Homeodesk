const crypto = require('crypto');

/**
 * Password hashing using Node's built-in scrypt KDF — no native dependency
 * to compile (unlike bcrypt), and scrypt is a well-vetted, memory-hard KDF.
 * Stored format: "<salt-hex>:<hash-hex>" so each password has its own salt.
 */
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  const hashBuffer = Buffer.from(hashHex, 'hex');
  const testBuffer = crypto.scryptSync(String(password), salt, KEY_LENGTH);
  if (hashBuffer.length !== testBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, testBuffer);
}

module.exports = { hashPassword, verifyPassword };
