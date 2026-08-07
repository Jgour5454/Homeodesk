const express = require('express');
const { v4: uuidv4 } = require('uuid');
const JsonStore = require('../utils/jsonStore');
const { isNonEmptyString } = require('../utils/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { findById: findUserById } = require('../utils/userStore');

const router = express.Router();
const store = new JsonStore('dietPlans.json');

/**
 * Diet plans — doctor-authored nutrition/lifestyle plans assigned to a
 * specific patient. Same access model as clinical records:
 *   - every route requires a verified session (no anonymous reads/writes)
 *   - a patient can only ever see plans assigned to them
 *   - a doctor can only see/write/edit/delete plans they personally created
 */
router.use(requireAuth);

// Turns a textarea's "one item per line" (or comma-separated) input into a
// clean array of trimmed, non-empty strings.
function toList(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (!isNonEmptyString(v)) return [];
  return v.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
}

/**
 * POST /api/diet-plans — doctor only.
 * Creates a new diet plan, always linked to a real registered patient
 * account (never free-text) and to the authenticated doctor as its author.
 */
router.post('/', requireRole('doctor'), (req, res) => {
  const {
    patientId, title, condition, status,
    breakfast, lunch, dinner, foodsToInclude, foodsToAvoid,
    hydration, lifestyle, notes,
  } = req.body || {};

  const errors = {};
  const patient = isNonEmptyString(patientId) ? findUserById(patientId) : null;
  if (!isNonEmptyString(patientId)) errors.patientId = 'A patient must be selected.';
  else if (!patient || patient.role !== 'patient') errors.patientId = 'Selected patient was not found.';
  if (!isNonEmptyString(title)) errors.title = 'A plan title is required.';

  if (Object.keys(errors).length > 0) return res.status(400).json({ ok: false, errors });

  const now = new Date().toISOString();
  const plan = {
    id: uuidv4(),
    patientId: patient.id,
    patientName: patient.name,
    patientEmail: patient.email,
    doctorId: req.user.id,
    doctorName: req.user.name,
    title: title.trim(),
    condition: isNonEmptyString(condition) ? condition.trim() : '',
    status: status === 'inactive' ? 'inactive' : 'active',
    meals: {
      breakfast: toList(breakfast),
      lunch: toList(lunch),
      dinner: toList(dinner),
    },
    foodsToInclude: toList(foodsToInclude),
    foodsToAvoid: toList(foodsToAvoid),
    hydration: isNonEmptyString(hydration) ? hydration.trim() : '',
    lifestyle: toList(lifestyle),
    notes: isNonEmptyString(notes) ? notes.trim() : '',
    createdAt: now,
    updatedAt: now,
  };

  store.create(plan);
  return res.status(201).json({ ok: true, plan });
});

/**
 * GET /api/diet-plans
 * Patients: always forced to their own id — a patient can never pass
 * ?patientId= to read someone else's plan.
 * Doctors: forced to plans they authored; optionally narrowed further by
 * ?patientId= to pull one patient's plan history.
 */
router.get('/', (req, res) => {
  let results;
  if (req.user.role === 'doctor') {
    const { patientId } = req.query;
    results = store.findAll((p) => {
      if (p.doctorId !== req.user.id) return false;
      if (patientId && p.patientId !== patientId) return false;
      return true;
    });
  } else {
    results = store.findAll((p) => p.patientId === req.user.id);
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ ok: true, plans: results });
});

/**
 * GET /api/diet-plans/:id
 * Only the owning patient or the authoring doctor may fetch a single plan.
 */
router.get('/:id', (req, res) => {
  const plan = store.findById(req.params.id);
  if (!plan) return res.status(404).json({ ok: false, error: 'Diet plan not found.' });

  const isOwner = req.user.role === 'patient' && plan.patientId === req.user.id;
  const isAuthor = req.user.role === 'doctor' && plan.doctorId === req.user.id;
  if (!isOwner && !isAuthor) {
    return res.status(403).json({ ok: false, error: 'You do not have permission to view this plan.' });
  }
  return res.json({ ok: true, plan });
});

/**
 * PATCH /api/diet-plans/:id — doctor only, and only over plans they authored.
 */
router.patch('/:id', requireRole('doctor'), (req, res) => {
  const existing = store.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Diet plan not found.' });
  if (existing.doctorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'You can only edit plans you authored.' });
  }

  const {
    title, condition, status, breakfast, lunch, dinner,
    foodsToInclude, foodsToAvoid, hydration, lifestyle, notes,
  } = req.body || {};
  const errors = {};
  const patch = {};

  if (title !== undefined) {
    if (!isNonEmptyString(title)) errors.title = 'Plan title cannot be empty.';
    else patch.title = title.trim();
  }
  if (condition !== undefined) patch.condition = String(condition).trim();
  if (status !== undefined) patch.status = status === 'inactive' ? 'inactive' : 'active';
  if (hydration !== undefined) patch.hydration = String(hydration).trim();
  if (notes !== undefined) patch.notes = String(notes).trim();
  if (breakfast !== undefined || lunch !== undefined || dinner !== undefined) {
    patch.meals = {
      breakfast: breakfast !== undefined ? toList(breakfast) : existing.meals.breakfast,
      lunch: lunch !== undefined ? toList(lunch) : existing.meals.lunch,
      dinner: dinner !== undefined ? toList(dinner) : existing.meals.dinner,
    };
  }
  if (foodsToInclude !== undefined) patch.foodsToInclude = toList(foodsToInclude);
  if (foodsToAvoid !== undefined) patch.foodsToAvoid = toList(foodsToAvoid);
  if (lifestyle !== undefined) patch.lifestyle = toList(lifestyle);

  if (Object.keys(errors).length > 0) return res.status(400).json({ ok: false, errors });

  const updated = store.updateById(req.params.id, patch);
  return res.json({ ok: true, plan: updated });
});

/**
 * DELETE /api/diet-plans/:id — doctor only, and only over plans they authored.
 */
router.delete('/:id', requireRole('doctor'), (req, res) => {
  const existing = store.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Diet plan not found.' });
  if (existing.doctorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'You can only delete plans you authored.' });
  }
  store.deleteById(req.params.id);
  return res.json({ ok: true, message: 'Diet plan deleted.' });
});

module.exports = router;
