const express = require('express');
const { v4: uuidv4 } = require('uuid');
const JsonStore = require('../utils/jsonStore');
const { isNonEmptyString, isValidAnyDate } = require('../utils/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { findById: findUserById } = require('../utils/userStore');

const router = express.Router();
const store = new JsonStore('records.json');
const appointmentsStore = new JsonStore('appointments.json');
const consultationsStore = new JsonStore('consultations.json');

/**
 * Patient clinical records — visit notes, remedies, follow-ups.
 * This is PHI, so every route below requires a verified session (no
 * anonymous reads/writes at all, unlike appointments/consultations), and
 * every route further scopes results to "your own" data:
 *   - a patient can only ever see their own records
 *   - a doctor can only see/write/edit/delete records they personally authored
 */
router.use(requireAuth);

/**
 * POST /api/records — doctor only.
 * Creates a new visit record, automatically linked to both the patient and
 * the authenticated doctor. patientId must reference a real, registered
 * patient account (never a free-text name) so the link is always genuine —
 * and doctorId is always taken from the verified session, never from the
 * request body, so a record can't be authored "as" another doctor.
 */
router.post('/', requireRole('doctor'), (req, res) => {
  const {
    patientId, visitDate, chiefComplaint, diagnosis, remedy, potency, notes, followUpDate,
  } = req.body || {};

  const errors = {};
  const patient = isNonEmptyString(patientId) ? findUserById(patientId) : null;
  if (!isNonEmptyString(patientId)) errors.patientId = 'A patient must be selected.';
  else if (!patient || patient.role !== 'patient') errors.patientId = 'Selected patient was not found.';

  if (!isValidAnyDate(visitDate)) errors.visitDate = 'A valid visit date is required.';
  if (!isNonEmptyString(chiefComplaint)) errors.chiefComplaint = 'Chief complaint is required.';
  if (!isNonEmptyString(remedy)) errors.remedy = 'Prescribed remedy is required.';
  if (isNonEmptyString(followUpDate) && !isValidAnyDate(followUpDate)) errors.followUpDate = 'Follow-up date is invalid.';

  if (Object.keys(errors).length > 0) return res.status(400).json({ ok: false, errors });

  const now = new Date().toISOString();
  const record = {
    id: uuidv4(),
    patientId: patient.id,
    patientName: patient.name,
    patientEmail: patient.email,
    doctorId: req.user.id,
    doctorName: req.user.name,
    visitDate,
    chiefComplaint: chiefComplaint.trim(),
    diagnosis: isNonEmptyString(diagnosis) ? diagnosis.trim() : '',
    remedy: remedy.trim(),
    potency: isNonEmptyString(potency) ? potency.trim() : '',
    notes: isNonEmptyString(notes) ? notes.trim() : '',
    followUpDate: isNonEmptyString(followUpDate) ? followUpDate.trim() : '',
    createdAt: now,
    updatedAt: now,
  };

  store.create(record);
  return res.status(201).json({ ok: true, record });
});

/**
 * GET /api/records
 * Patients: always forced to their own id, regardless of any query param —
 * a patient can never pass ?patientId= to read someone else's chart.
 * Doctors: forced to records they authored; optionally narrowed further by
 * ?patientId= to pull one patient's history.
 */
router.get('/', (req, res) => {
  let results;
  if (req.user.role === 'doctor') {
    const { patientId } = req.query;
    results = store.findAll((r) => {
      if (r.doctorId !== req.user.id) return false;
      if (patientId && r.patientId !== patientId) return false;
      return true;
    });
  } else {
    results = store.findAll((r) => r.patientId === req.user.id);
  }

  results.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
  return res.json({ ok: true, records: results });
});

/**
 * GET /api/records/patients/list — doctor only.
 * The patient roster for the "Patients" dashboard, built entirely from this
 * doctor's own appointments/consultations/records — never a dump of every
 * registered patient in the system.
 */
router.get('/patients/list', requireRole('doctor'), (req, res) => {
  const appts = appointmentsStore.findAll((a) => a.doctorId === req.user.id && a.patientId);
  const consults = consultationsStore.findAll((c) => c.doctorId === req.user.id && c.patientId);
  const recs = store.findAll((r) => r.doctorId === req.user.id);

  const ids = new Set([
    ...appts.map((a) => a.patientId),
    ...consults.map((c) => c.patientId),
    ...recs.map((r) => r.patientId),
  ]);

  const patients = Array.from(ids).map((id) => {
    const u = findUserById(id);
    const theirRecords = recs.filter((r) => r.patientId === id)
      .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    const fallbackAppt = appts.find((a) => a.patientId === id);
    const fallbackConsult = consults.find((c) => c.patientId === id);
    return {
      id,
      name: (u && u.name)
        || (fallbackAppt && `${fallbackAppt.firstName || ''} ${fallbackAppt.lastName || ''}`.trim())
        || (fallbackConsult && fallbackConsult.name)
        || 'Unknown patient',
      email: (u && u.email) || (fallbackAppt && fallbackAppt.email) || (fallbackConsult && fallbackConsult.email) || '',
      phone: (u && u.phone) || (fallbackAppt && fallbackAppt.phone) || (fallbackConsult && fallbackConsult.phone) || '',
      recordCount: theirRecords.length,
      lastVisit: theirRecords[0] ? theirRecords[0].visitDate : null,
      lastRemedy: theirRecords[0] ? theirRecords[0].remedy : null,
    };
  });

  patients.sort((a, b) => a.name.localeCompare(b.name));
  return res.json({ ok: true, patients });
});

/**
 * GET /api/records/:id
 * Only the owning patient or the authoring doctor may fetch a single
 * record — a plain 403 for anyone else, even other logged-in patients or
 * doctors.
 */
router.get('/:id', (req, res) => {
  const record = store.findById(req.params.id);
  if (!record) return res.status(404).json({ ok: false, error: 'Record not found.' });

  const isOwner = req.user.role === 'patient' && record.patientId === req.user.id;
  const isAuthor = req.user.role === 'doctor' && record.doctorId === req.user.id;
  if (!isOwner && !isAuthor) {
    return res.status(403).json({ ok: false, error: 'You do not have permission to view this record.' });
  }
  return res.json({ ok: true, record });
});

/**
 * PATCH /api/records/:id — doctor only, and only over records they authored.
 */
router.patch('/:id', requireRole('doctor'), (req, res) => {
  const existing = store.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Record not found.' });
  if (existing.doctorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'You can only edit records you authored.' });
  }

  const {
    visitDate, chiefComplaint, diagnosis, remedy, potency, notes, followUpDate,
  } = req.body || {};
  const errors = {};
  const patch = {};

  if (visitDate !== undefined) {
    if (!isValidAnyDate(visitDate)) errors.visitDate = 'Invalid visit date.';
    else patch.visitDate = visitDate;
  }
  if (chiefComplaint !== undefined) {
    if (!isNonEmptyString(chiefComplaint)) errors.chiefComplaint = 'Chief complaint cannot be empty.';
    else patch.chiefComplaint = chiefComplaint.trim();
  }
  if (remedy !== undefined) {
    if (!isNonEmptyString(remedy)) errors.remedy = 'Remedy cannot be empty.';
    else patch.remedy = remedy.trim();
  }
  if (followUpDate !== undefined) {
    if (isNonEmptyString(followUpDate) && !isValidAnyDate(followUpDate)) errors.followUpDate = 'Invalid follow-up date.';
    else patch.followUpDate = String(followUpDate || '').trim();
  }
  if (diagnosis !== undefined) patch.diagnosis = String(diagnosis).trim();
  if (potency !== undefined) patch.potency = String(potency).trim();
  if (notes !== undefined) patch.notes = String(notes).trim();

  if (Object.keys(errors).length > 0) return res.status(400).json({ ok: false, errors });

  const updated = store.updateById(req.params.id, patch);
  return res.json({ ok: true, record: updated });
});

/**
 * DELETE /api/records/:id — doctor only, and only over records they authored.
 */
router.delete('/:id', requireRole('doctor'), (req, res) => {
  const existing = store.findById(req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Record not found.' });
  if (existing.doctorId !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'You can only delete records you authored.' });
  }
  store.deleteById(req.params.id);
  return res.json({ ok: true, message: 'Record deleted.' });
});

module.exports = router;
