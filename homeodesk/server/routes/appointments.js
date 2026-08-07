const express = require('express');
const { v4: uuidv4 } = require('uuid');
const JsonStore = require('../utils/jsonStore');
const {
  isNonEmptyString, isValidPhone, isValidEmail, isValidDate, isValidTimeSlot, isValidType,
} = require('../utils/validate');
const { resolveDoctorId, findDoctorById } = require('../utils/doctorStore');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const store = new JsonStore('appointments.json');

/**
 * POST /api/appointments
 * Create a new appointment request (used by the public "Book an Appointment" page
 * and the patient portal booking form).
 */
router.post('/', (req, res) => {
  const {
    firstName, lastName, phone, email, date, timeSlot, type, concern, patientId, doctorId,
  } = req.body || {};

  const errors = {};
  if (!isNonEmptyString(firstName)) errors.firstName = 'First name is required.';
  if (!isNonEmptyString(lastName)) errors.lastName = 'Last name is required.';
  if (!isValidPhone(phone)) errors.phone = 'A valid phone number is required.';
  if (!isValidEmail(email)) errors.email = 'Email address looks invalid.';
  if (!isValidDate(date)) errors.date = 'Please choose a valid, upcoming date.';
  if (!isValidTimeSlot(timeSlot)) errors.timeSlot = 'Please choose a valid time slot.';
  if (!isValidType(type)) errors.type = 'Please choose a valid consultation type.';
  if (!isNonEmptyString(concern)) errors.concern = 'Please briefly describe your health concern.';

  // Work out which doctor this appointment gets assigned to, reading from
  // the doctors table rather than hardcoding an id here.
  const resolvedDoctorId = resolveDoctorId(doctorId);
  if (resolvedDoctorId === undefined) errors.doctorId = 'Selected doctor was not found.';
  if (resolvedDoctorId === null) errors.doctorId = 'No doctors are currently available to take appointments.';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  const doctor = findDoctorById(resolvedDoctorId);
  const now = new Date().toISOString();
  const appointment = {
    id: uuidv4(),
    patientId: patientId || null,
    doctorId: resolvedDoctorId,
    doctorName: doctor ? doctor.name : '',
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : '',
    date,
    timeSlot,
    type,
    concern: concern.trim(),
    status: 'pending',
    notes: '',
    meetingLink: '',
    createdAt: now,
    updatedAt: now,
  };

  store.create(appointment);
  return res.status(201).json({
    ok: true,
    message: "Appointment request received! We'll confirm your slot within 2 hours.",
    appointment,
  });
});

/**
 * GET /api/appointments
 * List appointments. Optional filters: ?phone=, ?email=, ?patientId=, ?status=, ?doctorId=
 * (Used by the doctor's "All Appointments" view — filtered to their own doctorId —
 * and the patient's "My Appointments" view.)
 *
 * The ?doctorId= view exposes every patient's contact details and health
 * concerns, so it's doctor-only, and only for that doctor's own id — a
 * logged-in doctor can't be tricked into pulling another doctor's list.
 */
router.get('/', (req, res, next) => {
  if (req.query.doctorId) return requireAuth(req, res, () => requireRole('doctor')(req, res, next));
  return next();
}, (req, res) => {
  const {
    phone, email, patientId, status, doctorId,
  } = req.query;

  if (doctorId && doctorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'You can only view your own appointments.' });
  }

  const results = store.findAll((a) => {
    if (phone && a.phone !== phone) return false;
    if (email && a.email !== email) return false;
    if (patientId && a.patientId !== patientId) return false;
    if (status && a.status !== status) return false;
    if (doctorId && a.doctorId !== doctorId) return false;
    return true;
  });

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ ok: true, appointments: results });
});

/** GET /api/appointments/:id */
router.get('/:id', (req, res) => {
  const appointment = store.findById(req.params.id);
  if (!appointment) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
  return res.json({ ok: true, appointment });
});

/**
 * PATCH /api/appointments/:id
 * Doctor/admin use — update status, notes, meeting link, or reschedule.
 * Requires a logged-in doctor, and only over their own appointments.
 */
router.patch('/:id', requireAuth, requireRole('doctor'), (req, res) => {
  const existing = store.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
  if (existing.doctorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'You can only update your own appointments.' });
  }

  const patch = {};
  const {
    status, notes, meetingLink, date, timeSlot,
  } = req.body || {};

  if (status !== undefined) {
    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, errors: { status: `Status must be one of: ${allowed.join(', ')}` } });
    }
    patch.status = status;
  }
  if (notes !== undefined) patch.notes = String(notes);
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
  return res.json({ ok: true, appointment: updated });
});

/**
 * DELETE /api/appointments/:id
 * Patient-initiated cancellation. Soft-cancels rather than removing the record.
 */
router.delete('/:id', (req, res) => {
  const existing = store.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
  const updated = store.updateById(req.params.id, { status: 'cancelled' });
  return res.json({ ok: true, appointment: updated, message: 'Appointment cancelled.' });
});

module.exports = router;
