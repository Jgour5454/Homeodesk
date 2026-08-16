const express = require('express');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { isNonEmptyString, isValidPhone, isValidEmail, isValidDate, isValidTimeSlot, isValidType } = require('../utils/validate');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const oid = id => mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

async function resolveDoctor(id) {
  if (id) {
    const doctor = await User.findOne({ _id: oid(id), role: 'doctor' });
    return doctor || undefined;
  }
  return User.findOne({ role: 'doctor' }).sort({ createdAt: 1 });
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone, email, date, timeSlot, type, concern, doctorId } = req.body || {};
    const errors = {};
    if (!isNonEmptyString(firstName)) errors.firstName = 'First name is required.';
    if (!isNonEmptyString(lastName)) errors.lastName = 'Last name is required.';
    if (!isValidPhone(phone)) errors.phone = 'A valid phone number is required.';
    if (!isValidEmail(email)) errors.email = 'Email address looks invalid.';
    if (!isValidDate(date)) errors.date = 'Please choose a valid, upcoming date.';
    if (!isValidTimeSlot(timeSlot)) errors.timeSlot = 'Please choose a valid time slot.';
    if (!isValidType(type)) errors.type = 'Please choose a valid consultation type.';
    if (!isNonEmptyString(concern)) errors.concern = 'Please briefly describe your health concern.';

    const doctor = await resolveDoctor(doctorId);
    if (doctor === undefined) errors.doctorId = 'Selected doctor was not found.';
    if (!doctor) errors.doctorId = 'No doctors are currently available to take appointments.';
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

    const patientId = req.user && req.user.role === 'patient' ? req.user._id : null;
    const appointment = await Appointment.create({
      patientId, doctorId: doctor._id, doctorName: doctor.name,
      firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), email: String(email || '').trim().toLowerCase(),
      date, timeSlot, type, concern: concern.trim(), status: 'pending', notes: '', meetingLink: '',
    });
    return res.status(201).json({ ok: true, message: "Appointment request received! We'll confirm your slot within 2 hours.", appointment });
  } catch (err) {
    console.error('Create appointment error:', err);
    return res.status(500).json({ ok: false, error: 'Unable to create appointment.' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const query = req.user.role === 'doctor' ? { doctorId: req.user._id } : { patientId: req.user._id };
    if (req.query.status) query.status = req.query.status;
    const appointments = await Appointment.find(query).sort({ createdAt: -1 });
    return res.json({ ok: true, appointments });
  } catch (err) {
    console.error('List appointments error:', err);
    return res.status(500).json({ ok: false, error: 'Unable to load appointments.' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    const allowed = (req.user.role === 'doctor' && appointment.doctorId.equals(req.user._id)) || (req.user.role === 'patient' && appointment.patientId && appointment.patientId.equals(req.user._id));
    if (!allowed) return res.status(403).json({ ok: false, error: 'You do not have permission to view this appointment.' });
    return res.json({ ok: true, appointment });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to load appointment.' }); }
});

router.patch('/:id', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    const existing = await Appointment.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    if (!existing.doctorId.equals(req.user._id)) return res.status(403).json({ ok: false, error: 'You can only update your own appointments.' });
    const { status, notes, meetingLink, date, timeSlot } = req.body || {};
    const patch = {};
    if (status !== undefined) {
      const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!allowed.includes(status)) return res.status(400).json({ ok: false, errors: { status: `Status must be one of: ${allowed.join(', ')}` } });
      patch.status = status;
    }
    if (notes !== undefined) patch.notes = String(notes);
    if (meetingLink !== undefined) patch.meetingLink = String(meetingLink);
    if (date !== undefined) { if (!isValidDate(date)) return res.status(400).json({ ok: false, errors: { date: 'Invalid date.' } }); patch.date = date; }
    if (timeSlot !== undefined) { if (!isValidTimeSlot(timeSlot)) return res.status(400).json({ ok: false, errors: { timeSlot: 'Invalid time slot.' } }); patch.timeSlot = timeSlot; }
    Object.assign(existing, patch);
    await existing.save();
    return res.json({ ok: true, appointment: existing });
  } catch (err) { console.error(err); return res.status(500).json({ ok: false, error: 'Unable to update appointment.' }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    const existing = await Appointment.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Appointment not found.' });
    const allowed = (req.user.role === 'doctor' && existing.doctorId.equals(req.user._id)) || (req.user.role === 'patient' && existing.patientId && existing.patientId.equals(req.user._id));
    if (!allowed) return res.status(403).json({ ok: false, error: 'You do not have permission to cancel this appointment.' });
    existing.status = 'cancelled';
    await existing.save();
    return res.json({ ok: true, appointment: existing, message: 'Appointment cancelled.' });
  } catch (err) { return res.status(500).json({ ok: false, error: 'Unable to cancel appointment.' }); }
});
module.exports = router;
