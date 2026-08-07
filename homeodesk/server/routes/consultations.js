const express = require('express');
const { v4: uuidv4 } = require('uuid');
const JsonStore = require('../utils/jsonStore');
const {
  isNonEmptyString, isValidPhone, isValidEmail, isValidDate, isValidTimeSlot,
} = require('../utils/validate');
const { resolveDoctorId, findDoctorById } = require('../utils/doctorStore');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const store = new JsonStore('consultations.json');

/**
 * POST /api/consultations
 * Create a new online (video) consultation request from the "Online Consultation" page.
 */
router.post('/', (req, res) => {
  const {
    name, phone, email, date, timeSlot, concern, patientId, doctorId,
  } = req.body || {};

  const errors = {};
  if (!isNonEmptyString(name)) errors.name = 'Your name is required.';
  if (!isValidPhone(phone)) errors.phone = 'A valid phone number is required.';
  if (!isNonEmptyString(email) || !isValidEmail(email)) errors.email = 'A valid email is required (used to send the video link).';
  if (!isValidDate(date)) errors.date = 'Please choose a valid, upcoming date.';
  if (!isValidTimeSlot(timeSlot)) errors.timeSlot = 'Please choose a valid time slot.';
  if (!isNonEmptyString(concern)) errors.concern = 'Please describe your health concern.';

  // Work out which doctor this consultation gets assigned to, reading from
  // the doctors table rather than hardcoding an id here.
  const resolvedDoctorId = resolveDoctorId(doctorId);
  if (resolvedDoctorId === undefined) errors.doctorId = 'Selected doctor was not found.';
  if (resolvedDoctorId === null) errors.doctorId = 'No doctors are currently available to take consultations.';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  const doctor = findDoctorById(resolvedDoctorId);
  const now = new Date().toISOString();
  const consultation = {
    id: uuidv4(),
    patientId: patientId || null,
    doctorId: resolvedDoctorId,
    doctorName: doctor ? doctor.name : '',
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    date,
    timeSlot,
    concern: concern.trim(),
    status: 'pending', // pending -> confirmed (link sent) -> completed / cancelled
    meetingLink: '',
    createdAt: now,
    updatedAt: now,
  };

  store.create(consultation);
  return res.status(201).json({
    ok: true,
    message: "Your online consultation has been requested! Dr. Khimani's team will send you a video link within 2 hours.",
    consultation,
  });
});

/**
 * GET /api/consultations
 * Optional filters: ?phone=, ?email=, ?patientId=, ?status=, ?doctorId=
 *
 * The ?doctorId= view exposes every patient's contact details and health
 * concerns, so it's doctor-only, and only for that doctor's own id.
 */
router.get('/', (req, res, next) => {
  if (req.query.doctorId) return requireAuth(req, res, () => requireRole('doctor')(req, res, next));
  return next();
}, (req, res) => {
  const {
    phone, email, patientId, status, doctorId,
  } = req.query;

  if (doctorId && doctorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'You can only view your own consultations.' });
  }

  const results = store.findAll((c) => {
    if (phone && c.phone !== phone) return false;
    if (email && c.email !== email) return false;
    if (patientId && c.patientId !== patientId) return false;
    if (status && c.status !== status) return false;
    if (doctorId && c.doctorId !== doctorId) return false;
    return true;
  });

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ ok: true, consultations: results });
});

/** GET /api/consultations/:id */
router.get('/:id', (req, res) => {
  const consultation = store.findById(req.params.id);
  if (!consultation) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
  return res.json({ ok: true, consultation });
});

/**
 * PATCH /api/consultations/:id
 * Doctor/admin use — confirm, attach a video meeting link, mark completed, etc.
 * Requires a logged-in doctor, and only over their own consultations.
 */
router.patch('/:id', requireAuth, requireRole('doctor'), (req, res) => {
  const existing = store.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
  if (existing.doctorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'You can only update your own consultations.' });
  }

  const patch = {};
  const {
    status, meetingLink, date, timeSlot,
  } = req.body || {};

  if (status !== undefined) {
    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, errors: { status: `Status must be one of: ${allowed.join(', ')}` } });
    }
    patch.status = status;
  }
  if (meetingLink !== undefined) patch.meetingLink = String(meetingLink);
  if (date !== undefined) {
    if (!isValidDate(date)) return res.status(400).json({ ok: false, errors: { date: 'Invalid date.' } });
    patch.date = date;
  }
  if (timeSlot !== undefined) {
    if (!isValidTimeSlot(timeSlot)) return res.status(400).json({ ok: false, errors: { timeSlot: 'Invalid time slot.' } });
    patch.timeSlot = timeSlot;
  }

  const updated = store.updateById(req.params.id, patch);
  return res.json({ ok: true, consultation: updated });
});

/** DELETE /api/consultations/:id — cancel */
router.delete('/:id', (req, res) => {
  const existing = store.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
  const updated = store.updateById(req.params.id, { status: 'cancelled' });
  return res.json({ ok: true, consultation: updated, message: 'Consultation cancelled.' });
});

module.exports = router;
