const express = require('express');
const { v4: uuidv4 } = require('uuid');
const JsonStore = require('../utils/jsonStore');
const { isNonEmptyString } = require('../utils/validate');
const { resolveDoctorId, findDoctorById } = require('../utils/doctorStore');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const store = new JsonStore('feedback.json');

const CATEGORIES = ['treatment', 'doctor', 'clinic', 'online-consultation', 'general'];

/**
 * Patient feedback — a patient's rating/review of the clinic. Same access
 * model as records/diet-plans:
 *   - every route requires a verified session (no anonymous reads/writes)
 *   - a patient can only ever submit as themselves and only ever see their
 *     own feedback (never someone else's, and never by passing patientId)
 *   - a doctor sees every review addressed to them, straight from the
 *     database — this is what makes it "directly visible to the doctor"
 *     instead of the old hardcoded demo list
 */
router.use(requireAuth);

/**
 * POST /api/feedback — patient only.
 * patientId/patientName/patientEmail are always taken from the verified
 * session, never from the request body, so a review can't be submitted
 * "as" another patient.
 */
router.post('/', requireRole('patient'), (req, res) => {
  const { rating, category, message, doctorId } = req.body || {};

  const errors = {};
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    errors.rating = 'Please choose a rating between 1 and 5.';
  }
  if (isNonEmptyString(category) && !CATEGORIES.includes(category)) {
    errors.category = 'Please choose a valid category.';
  }
  if (!isNonEmptyString(message)) errors.message = 'Please share a few words of feedback.';

  const resolvedDoctorId = resolveDoctorId(doctorId);
  if (resolvedDoctorId === undefined) errors.doctorId = 'Selected doctor was not found.';
  if (resolvedDoctorId === null) errors.doctorId = 'No doctors are currently registered to receive feedback.';

  if (Object.keys(errors).length > 0) return res.status(400).json({ ok: false, errors });

  const doctor = findDoctorById(resolvedDoctorId);
  const now = new Date().toISOString();
  const feedback = {
    id: uuidv4(),
    patientId: req.user.id,
    patientName: req.user.name,
    patientEmail: req.user.email,
    doctorId: resolvedDoctorId,
    doctorName: doctor ? doctor.name : '',
    rating: numericRating,
    category: isNonEmptyString(category) ? category : 'general',
    message: message.trim(),
    createdAt: now,
    updatedAt: now,
  };

  store.create(feedback);
  return res.status(201).json({ ok: true, feedback });
});

/**
 * GET /api/feedback
 * Patients: always forced to their own id, regardless of any query param.
 * Doctors: every review addressed to them, newest first — this is the feed
 * the "Patient Feedback" panel in the doctor portal reads from.
 */
router.get('/', (req, res) => {
  let results;
  if (req.user.role === 'doctor') {
    results = store.findAll((f) => f.doctorId === req.user.id);
  } else {
    results = store.findAll((f) => f.patientId === req.user.id);
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ ok: true, feedback: results });
});

module.exports = router;
