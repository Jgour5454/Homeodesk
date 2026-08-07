require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { bootstrapDoctor } = require('./utils/bootstrapDoctor');
const appointmentsRouter = require('./routes/appointments');
const consultationsRouter = require('./routes/consultations');
const doctorsRouter = require('./routes/doctors');
const authRouter = require('./routes/auth');
const recordsRouter = require('./routes/records');
const dietPlansRouter = require('./routes/dietPlans');
const feedbackRouter = require('./routes/feedback');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Simple request log — helpful while wiring up the frontend
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'homeodesk-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/consultations', consultationsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/diet-plans', dietPlansRouter);
app.use('/api/feedback', feedbackRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found.' });
});

// Central error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ ok: false, error: 'Something went wrong on the server.' });
});

// Ensures the doctor account exists (and its password matches .env) on
// every boot — see utils/bootstrapDoctor.js for why this matters on hosts
// with an ephemeral filesystem.
bootstrapDoctor();

app.listen(PORT, () => {
  console.log(`HomeoDesk API listening on http://localhost:${PORT}`);
});
