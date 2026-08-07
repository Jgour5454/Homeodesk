const JsonStore = require('./jsonStore');

const store = new JsonStore('reset_codes.json');

function saveResetCode(email, code, expiresAt) {
  const targetEmail = String(email || '').trim().toLowerCase();
  const all = store.findAll();
  const existing = all.find(r => String(r.email).trim().toLowerCase() === targetEmail);

  const newRecord = {
    id: existing ? existing.id : Date.now().toString(),
    email: targetEmail,
    code: String(code),
    expiresAt,
    createdAt: new Date().toISOString(),
    status: 'active',
  };

  if (existing) {
    return store.updateById(existing.id, newRecord);
  } else {
    return store.create(newRecord);
  }
}

function getResetCode(email) {
  const targetEmail = String(email || '').trim().toLowerCase();
  const all = store.findAll(r => String(r.email).trim().toLowerCase() === targetEmail);
  return all[all.length - 1] || null;
}

module.exports = { saveResetCode, getResetCode };
