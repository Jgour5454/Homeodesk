const express = require('express');
const User = require('../models/User');

const router = express.Router();
router.get('/', async (_req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' }).select('name email phone').sort({ name: 1 }).lean();
    return res.json({ ok: true, doctors: doctors.map(d => ({ id: d._id.toString(), name: d.name, email: d.email, phone: d.phone || '' })) });
  } catch (err) {
    console.error('Doctor lookup error:', err);
    return res.status(500).json({ ok: false, error: 'Unable to load doctors.' });
  }
});
module.exports = router;
