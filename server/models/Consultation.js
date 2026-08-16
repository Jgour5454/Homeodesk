const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorName: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    concern: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending', index: true },
    meetingLink: { type: String, default: '' },
    legacyId: { type: String, default: null, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
consultationSchema.virtual('id').get(function () { return this._id.toString(); });
consultationSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r._id; delete r.__v; return r; } });
module.exports = mongoose.models.Consultation || mongoose.model('Consultation', consultationSchema);
