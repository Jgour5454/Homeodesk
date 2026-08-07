const JsonStore = require('./jsonStore');

const store = new JsonStore('users.json');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function findByEmail(email) {
  const target = normalizeEmail(email);
  return store.findAll((u) => normalizeEmail(u.email) === target)[0] || null;
}

function findById(id) {
  return store.findById(id);
}

function findByResetToken(token) {
  if (!token) return null;
  const target = String(token).trim();
  return store.findAll((u) => (u.resetPasswordToken && String(u.resetPasswordToken).trim() === target) || (u.resetPasswordCode && String(u.resetPasswordCode).trim() === target))[0] || null;
}

function createUser(user) {
  return store.create(user);
}

function updateUser(id, patch) {
  return store.updateById(id, patch);
}

module.exports = { findByEmail, findById, findByResetToken, createUser, updateUser, normalizeEmail };
