const mongoose = require('mongoose');

const dietPlanSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientName: { type: String, default: '' },
    patientEmail: { type: String, default: '' },
    doctorName: { type: String, default: '' },
    title: { type: String, required: true, trim: true },
    condition: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    meals: {
      breakfast: { type: [String], default: [] },
      lunch: { type: [String], default: [] },
      dinner: { type: [String], default: [] },
    },
    foodsToInclude: { type: [String], default: [] },
    foodsToAvoid: { type: [String], default: [] },
    hydration: { type: String, default: '' },
    lifestyle: { type: [String], default: [] },
    notes: { type: String, default: '' },
    legacyId: { type: String, default: null, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
dietPlanSchema.virtual('id').get(function () { return this._id.toString(); });
dietPlanSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r._id; delete r.__v; return r; } });
module.exports = mongoose.models.DietPlan || mongoose.model('DietPlan', dietPlanSchema);
