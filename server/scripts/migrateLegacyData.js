require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Consultation = require('../models/Consultation');
const ClinicalRecord = require('../models/ClinicalRecord');
const DietPlan = require('../models/DietPlan');
const Feedback = require('../models/Feedback');
const { hashPassword } = require('../utils/password');

const DIR = path.join(__dirname, '..', 'migrations', 'legacy-data');
function read(name) { const p = path.join(DIR, name); if (!fs.existsSync(p)) return []; return JSON.parse(fs.readFileSync(p, 'utf8') || '[]'); }
function oid(id) { return id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null; }

async function upsertUser(raw) {
  const email = String(raw.email || '').trim().toLowerCase();
  if (!email) return null;
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ name: raw.name || 'User', email, phone: raw.phone || '', role: raw.role === 'doctor' ? 'doctor' : 'patient', passwordHash: raw.passwordHash || hashPassword(cryptoRandomPassword()), legacyId: String(raw.id || '') });
  else if (!user.legacyId && raw.id) { user.legacyId = String(raw.id); await user.save(); }
  return user;
}
function cryptoRandomPassword() { return require('crypto').randomBytes(24).toString('hex'); }

async function main() {
  await connectDB();
  const users = read('users.json');
  const map = new Map();
  for (const raw of users) { const u = await upsertUser(raw); if (u && raw.id) map.set(String(raw.id), u); }

  const doctors = await User.find({ role: 'doctor' });
  if (doctors.length === 0) console.warn('No doctor exists in MongoDB. Run seed:doctor after setting DOCTOR_* variables.');
  const firstDoctor = doctors[0];
  const doctorFor = legacyId => map.get(String(legacyId)) || (firstDoctor || null);

  for (const raw of read('appointments.json')) {
    if (raw.legacyId || !raw.id) continue;
    const d = doctorFor(raw.doctorId); if (!d) continue;
    const p = map.get(String(raw.patientId));
    await Appointment.create({ patientId: p?._id || null, doctorId: d._id, doctorName: d.name, firstName: raw.firstName || '', lastName: raw.lastName || '', phone: raw.phone || '', email: raw.email || '', date: raw.date, timeSlot: raw.timeSlot, type: raw.type || 'in-clinic', concern: raw.concern || '', status: raw.status || 'pending', notes: raw.notes || '', meetingLink: raw.meetingLink || '', legacyId: String(raw.id) });
  }
  for (const raw of read('consultations.json')) {
    if (raw.legacyId || !raw.id) continue;
    const d = doctorFor(raw.doctorId); if (!d) continue;
    const p = map.get(String(raw.patientId));
    await Consultation.create({ patientId: p?._id || null, doctorId: d._id, doctorName: d.name, name: raw.name || '', phone: raw.phone || '', email: raw.email || '', date: raw.date, timeSlot: raw.timeSlot, concern: raw.concern || '', status: raw.status || 'pending', meetingLink: raw.meetingLink || '', legacyId: String(raw.id) });
  }
  for (const raw of read('records.json')) {
    if (raw.legacyId || !raw.id) continue;
    const p = map.get(String(raw.patientId)); const d = doctorFor(raw.doctorId); if (!p || !d) continue;
    await ClinicalRecord.create({ patientId:p._id, patientName:p.name, patientEmail:p.email, doctorId:d._id, doctorName:d.name, visitDate:raw.visitDate, chiefComplaint:raw.chiefComplaint || '', diagnosis:raw.diagnosis || '', remedy:raw.remedy || '', potency:raw.potency || '', notes:raw.notes || '', followUpDate:raw.followUpDate || '', legacyId:String(raw.id) });
  }
  for (const raw of read('dietPlans.json')) {
    if (raw.legacyId || !raw.id) continue;
    const p = map.get(String(raw.patientId)); const d = doctorFor(raw.doctorId); if (!p || !d) continue;
    await DietPlan.create({ patientId:p._id, patientName:p.name, patientEmail:p.email, doctorId:d._id, doctorName:d.name, title:raw.title || 'Diet Plan', condition:raw.condition || '', status:raw.status === 'inactive' ? 'inactive' : 'active', meals:raw.meals || {}, foodsToInclude:raw.foodsToInclude || [], foodsToAvoid:raw.foodsToAvoid || [], hydration:raw.hydration || '', lifestyle:raw.lifestyle || [], notes:raw.notes || '', legacyId:String(raw.id) });
  }
  for (const raw of read('feedback.json')) {
    if (raw.legacyId || !raw.id) continue;
    const p = map.get(String(raw.patientId)); const d = doctorFor(raw.doctorId); if (!p || !d) continue;
    await Feedback.create({ patientId:p._id, patientName:p.name, patientEmail:p.email, doctorId:d._id, doctorName:d.name, rating:Number(raw.rating)||1, category:raw.category || 'general', message:raw.message || '', legacyId:String(raw.id), createdAt:raw.createdAt || undefined, updatedAt:raw.updatedAt || undefined });
  }
  console.log('Legacy JSON migration completed. The application itself does not read the JSON files.');
  await mongoose.disconnect();
}

main().catch(err => { console.error('Legacy migration failed:', err); process.exit(1); });
