const express = require('express');
const { listDoctors } = require('../utils/doctorStore');

const router = express.Router();

/**
 * GET /api/doctors
 * Dynamic list of doctors from the database (no hardcoded values in the
 * frontend). Used to resolve a doctor's display name and, if the clinic
 * ever has more than one doctor, to let a patient pick who to book with.
 */
router.get('/', (req, res) => {
  const doctors = listDoctors().map(({ id, name, email }) => ({ id, name, email }));
  return res.json({ ok: true, doctors });
});

module.exports = router;
