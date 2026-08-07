const fs = require('fs');
const path = require('path');

/**
 * Minimal file-backed JSON collection store.
 * Good enough for a small clinic booking app without needing a native DB driver.
 * Swap this out for MongoDB/Postgres later without changing route logic much,
 * since it exposes the same basic CRUD shape (findAll, findById, create, updateById, deleteById).
 */
class JsonStore {
  constructor(fileName) {
    this.filePath = path.join(__dirname, '..', 'data', fileName);
    this._ensureFile();
  }

  _ensureFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, '[]', 'utf-8');
  }

  _readAll() {
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    try {
      return JSON.parse(raw || '[]');
    } catch {
      return [];
    }
  }

  _writeAll(records) {
    fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf-8');
  }

  findAll(filterFn) {
    const all = this._readAll();
    return typeof filterFn === 'function' ? all.filter(filterFn) : all;
  }

  findById(id) {
    return this._readAll().find((r) => r.id === id) || null;
  }

  create(record) {
    const all = this._readAll();
    all.push(record);
    this._writeAll(all);
    return record;
  }

  updateById(id, patch) {
    const all = this._readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    this._writeAll(all);
    return all[idx];
  }

  deleteById(id) {
    const all = this._readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    this._writeAll(all);
    return true;
  }
}

module.exports = JsonStore;
