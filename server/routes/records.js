const express = require('express');
const mongoose = require('mongoose');
const ClinicalRecord = require('../models/ClinicalRecord');
const Appointment = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const User = require('../models/User');
const { isNonEmptyString, isValidAnyDate } = require('../utils/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(requireAuth);

router.post('/', requireRole('doctor'), async (req, res) => {
  try {
    const { patientId, visitDate, chiefComplaint, diagnosis, remedy, potency, notes, followUpDate } = req.body || {};
    const errors = {};
    const patient = isNonEmptyString(patientId) && mongoose.isValidObjectId(patientId) ? await User.findOne({ _id: patientId, role: 'patient' }) : null;
    if (!isNonEmptyString(patientId)) errors.patientId = 'A patient must be selected.';
    else if (!patient) errors.patientId = 'Selected patient was not found.';
    if (!isValidAnyDate(visitDate)) errors.visitDate = 'A valid visit date is required.';
    if (!isNonEmptyString(chiefComplaint)) errors.chiefComplaint = 'Chief complaint is required.';
    if (!isNonEmptyString(remedy)) errors.remedy = 'Prescribed remedy is required.';
    if (isNonEmptyString(followUpDate) && !isValidAnyDate(followUpDate)) errors.followUpDate = 'Follow-up date is invalid.';
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });
    const record = await ClinicalRecord.create({ patientId: patient._id, patientName: patient.name, patientEmail: patient.email, doctorId: req.user._id, doctorName: req.user.name, visitDate, chiefComplaint: chiefComplaint.trim(), diagnosis: String(diagnosis || '').trim(), remedy: remedy.trim(), potency: String(potency || '').trim(), notes: String(notes || '').trim(), followUpDate: String(followUpDate || '').trim() });
    return res.status(201).json({ ok: true, record });
  } catch (err) { console.error(err); return res.status(500).json({ ok: false, error: 'Unable to create clinical record.' }); }
});

router.get('/', async (req, res) => {
  try {
    const query = req.user.role === 'doctor' ? { doctorId: req.user._id } : { patientId: req.user._id };
    if (req.user.role === 'doctor' && req.query.patientId && mongoose.isValidObjectId(req.query.patientId)) query.patientId = req.query.patientId;
    const records = await ClinicalRecord.find(query).sort({ visitDate: -1, createdAt: -1 });
    return res.json({ ok: true, records });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to load records.' }); }
});

router.get('/patients/list', requireRole('doctor'), async (req, res) => {
  try {
    const [appts, consults, recs] = await Promise.all([
      Appointment.find({ doctorId: req.user._id, patientId: { $ne: null } }).lean(),
      Consultation.find({ doctorId: req.user._id, patientId: { $ne: null } }).lean(),
      ClinicalRecord.find({ doctorId: req.user._id }).lean(),
    ]);
    const ids = [...new Set([...appts, ...consults, ...recs].map(x => String(x.patientId)).filter(Boolean))];
    const users = await User.find({ _id: { $in: ids }, role: 'patient' }).lean();
    const map = new Map(users.map(u => [String(u._id), u]));
    const patients = ids.map(id => {
      const u = map.get(id);
      const theirRecords = recs.filter(r => String(r.patientId) === id).sort((a,b) => new Date(b.visitDate)-new Date(a.visitDate));
      const a = appts.find(x => String(x.patientId) === id);
      const c = consults.find(x => String(x.patientId) === id);
      return { id, name: u?.name || (`${a?.firstName || ''} ${a?.lastName || ''}`.trim()) || c?.name || 'Unknown patient', email: u?.email || a?.email || c?.email || '', phone: u?.phone || a?.phone || c?.phone || '', recordCount: theirRecords.length, lastVisit: theirRecords[0]?.visitDate || null, lastRemedy: theirRecords[0]?.remedy || null };
    });
    patients.sort((a,b) => a.name.localeCompare(b.name));
    return res.json({ ok: true, patients });
  } catch (err) { console.error(err); return res.status(500).json({ ok: false, error: 'Unable to load patient roster.' }); }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Record not found.' });
    const record = await ClinicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ ok: false, error: 'Record not found.' });
    const allowed = (req.user.role === 'doctor' && record.doctorId.equals(req.user._id)) || (req.user.role === 'patient' && record.patientId.equals(req.user._id));
    if (!allowed) return res.status(403).json({ ok: false, error: 'You do not have permission to view this record.' });
    return res.json({ ok: true, record });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to load record.' }); }
});

router.patch('/:id', requireRole('doctor'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Record not found.' });
    const existing = await ClinicalRecord.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Record not found.' });
    if (!existing.doctorId.equals(req.user._id)) return res.status(403).json({ ok: false, error: 'You can only edit records you authored.' });
    const { visitDate, chiefComplaint, diagnosis, remedy, potency, notes, followUpDate } = req.body || {};
    const errors = {};
    if (visitDate !== undefined) { if (!isValidAnyDate(visitDate)) errors.visitDate = 'Invalid visit date.'; else existing.visitDate = visitDate; }
    if (chiefComplaint !== undefined) { if (!isNonEmptyString(chiefComplaint)) errors.chiefComplaint = 'Chief complaint cannot be empty.'; else existing.chiefComplaint = chiefComplaint.trim(); }
    if (remedy !== undefined) { if (!isNonEmptyString(remedy)) errors.remedy = 'Remedy cannot be empty.'; else existing.remedy = remedy.trim(); }
    if (followUpDate !== undefined) { if (isNonEmptyString(followUpDate) && !isValidAnyDate(followUpDate)) errors.followUpDate = 'Invalid follow-up date.'; else existing.followUpDate = String(followUpDate || '').trim(); }
    if (diagnosis !== undefined) existing.diagnosis = String(diagnosis).trim();
    if (potency !== undefined) existing.potency = String(potency).trim();
    if (notes !== undefined) existing.notes = String(notes).trim();
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });
    await existing.save(); return res.json({ ok: true, record: existing });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to update record.' }); }
});

router.delete('/:id', requireRole('doctor'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Record not found.' });
    const existing = await ClinicalRecord.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Record not found.' });
    if (!existing.doctorId.equals(req.user._id)) return res.status(403).json({ ok: false, error: 'You can only delete records you authored.' });
    await existing.deleteOne(); return res.json({ ok: true, message: 'Record deleted.' });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to delete record.' }); }
});
module.exports = router;
