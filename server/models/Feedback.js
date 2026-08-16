const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: { type: String, default: '' },
    patientEmail: { type: String, default: '' },
    doctorName: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    category: { type: String, enum: ['treatment', 'doctor', 'clinic', 'online-consultation', 'general'], default: 'general' },
    message: { type: String, required: true, trim: true },
    legacyId: { type: String, default: null, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
feedbackSchema.virtual('id').get(function () { return this._id.toString(); });
feedbackSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r._id; delete r.__v; return r; } });
module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
