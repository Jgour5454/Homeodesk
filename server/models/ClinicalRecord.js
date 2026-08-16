const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: { type: String, default: '' },
    patientEmail: { type: String, default: '' },
    doctorName: { type: String, default: '' },
    visitDate: { type: String, required: true },
    chiefComplaint: { type: String, required: true, trim: true },
    diagnosis: { type: String, default: '' },
    remedy: { type: String, required: true, trim: true },
    potency: { type: String, default: '' },
    notes: { type: String, default: '' },
    followUpDate: { type: String, default: '' },
    legacyId: { type: String, default: null, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
recordSchema.virtual('id').get(function () { return this._id.toString(); });
recordSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r._id; delete r.__v; return r; } });
module.exports = mongoose.models.ClinicalRecord || mongoose.model('ClinicalRecord', recordSchema);
