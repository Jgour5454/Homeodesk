const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorName: { type: String, default: '' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    type: { type: String, enum: ['in-clinic', 'online', 'follow-up'], required: true },
    concern: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending', index: true },
    notes: { type: String, default: '' },
    meetingLink: { type: String, default: '' },
    legacyId: { type: String, default: null, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
appointmentSchema.virtual('id').get(function () { return this._id.toString(); });
appointmentSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r._id; delete r.__v; return r; } });
module.exports = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
