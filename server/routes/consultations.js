const express = require('express');
const mongoose = require('mongoose');
const Consultation = require('../models/Consultation');
const User = require('../models/User');
const { isNonEmptyString, isValidPhone, isValidEmail, isValidDate, isValidTimeSlot } = require('../utils/validate');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const router = express.Router();
const oid = id => mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

async function resolveDoctor(id) {
  if (id) { const doctor = await User.findOne({ _id: oid(id), role: 'doctor' }); return doctor || undefined; }
  return User.findOne({ role: 'doctor' }).sort({ createdAt: 1 });
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { name, phone, email, date, timeSlot, concern, doctorId } = req.body || {};
    const errors = {};
    if (!isNonEmptyString(name)) errors.name = 'Your name is required.';
    if (!isValidPhone(phone)) errors.phone = 'A valid phone number is required.';
    if (!isNonEmptyString(email) || !isValidEmail(email)) errors.email = 'A valid email is required (used to send the video link).';
    if (!isValidDate(date)) errors.date = 'Please choose a valid, upcoming date.';
    if (!isValidTimeSlot(timeSlot)) errors.timeSlot = 'Please choose a valid time slot.';
    if (!isNonEmptyString(concern)) errors.concern = 'Please describe your health concern.';
    const doctor = await resolveDoctor(doctorId);
    if (doctor === undefined) errors.doctorId = 'Selected doctor was not found.';
    if (!doctor) errors.doctorId = 'No doctors are currently available to take consultations.';
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });
    const patientId = req.user && req.user.role === 'patient' ? req.user._id : null;
    const consultation = await Consultation.create({ patientId, doctorId: doctor._id, doctorName: doctor.name, name: name.trim(), phone: phone.trim(), email: email.trim().toLowerCase(), date, timeSlot, concern: concern.trim(), status: 'pending', meetingLink: '' });
    return res.status(201).json({ ok: true, message: "Your online consultation has been requested! Dr. Khimani's team will send you a video link within 2 hours.", consultation });
  } catch (err) { console.error(err); return res.status(500).json({ ok: false, error: 'Unable to create consultation.' }); }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const query = req.user.role === 'doctor' ? { doctorId: req.user._id } : { patientId: req.user._id };
    if (req.query.status) query.status = req.query.status;
    const consultations = await Consultation.find(query).sort({ createdAt: -1 });
    return res.json({ ok: true, consultations });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to load consultations.' }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
    const allowed = (req.user.role === 'doctor' && consultation.doctorId.equals(req.user._id)) || (req.user.role === 'patient' && consultation.patientId && consultation.patientId.equals(req.user._id));
    if (!allowed) return res.status(403).json({ ok: false, error: 'You do not have permission to view this consultation.' });
    return res.json({ ok: true, consultation });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to load consultation.' }); }
});

router.patch('/:id', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
    const existing = await Consultation.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
    if (!existing.doctorId.equals(req.user._id)) return res.status(403).json({ ok: false, error: 'You can only update your own consultations.' });
    const { status, meetingLink, date, timeSlot } = req.body || {};
    if (status !== undefined) { const allowed = ['pending', 'confirmed', 'completed', 'cancelled']; if (!allowed.includes(status)) return res.status(400).json({ ok: false, errors: { status: `Status must be one of: ${allowed.join(', ')}` } }); existing.status = status; }
    if (meetingLink !== undefined) existing.meetingLink = String(meetingLink);
    if (date !== undefined) { if (!isValidDate(date)) return res.status(400).json({ ok: false, errors: { date: 'Invalid date.' } }); existing.date = date; }
    if (timeSlot !== undefined) { if (!isValidTimeSlot(timeSlot)) return res.status(400).json({ ok: false, errors: { timeSlot: 'Invalid time slot.' } }); existing.timeSlot = timeSlot; }
    await existing.save();
    return res.json({ ok: true, consultation: existing });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to update consultation.' }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
    const existing = await Consultation.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Consultation not found.' });
    const allowed = (req.user.role === 'doctor' && existing.doctorId.equals(req.user._id)) || (req.user.role === 'patient' && existing.patientId && existing.patientId.equals(req.user._id));
    if (!allowed) return res.status(403).json({ ok: false, error: 'You do not have permission to cancel this consultation.' });
    existing.status = 'cancelled'; await existing.save();
    return res.json({ ok: true, consultation: existing, message: 'Consultation cancelled.' });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to cancel consultation.' }); }
});
module.exports = router;
