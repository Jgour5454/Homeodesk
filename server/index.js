require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const bootstrapDoctor = require('./utils/bootstrapDoctor');
const chatbotRouter = require('./routes/chatbot');

const appointmentsRouter = require('./routes/appointments');
const consultationsRouter = require('./routes/consultations');
const doctorsRouter = require('./routes/doctors');
const authRouter = require('./routes/auth');
const recordsRouter = require('./routes/records');
const dietPlansRouter = require('./routes/dietPlans');
const feedbackRouter = require('./routes/feedback');

const app = express();
const PORT = Number(process.env.PORT || 5000);

const allowedOrigins = String(process.env.FRONTEND_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.includes('*') ? true : allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => { console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`); next(); });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'homeodesk-api', mongodb: mongoose.connection.readyState === 1, time: new Date().toISOString() }));
app.use('/api/auth', authRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/consultations', consultationsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/diet-plans', dietPlansRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/chatbot', chatbotRouter);

app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ ok: false, error: 'Something went wrong on the server.' }); });

async function startServer() {
  await connectDB();
  await bootstrapDoctor();
  app.listen(PORT, () => console.log(`HomeoDesk API running on port ${PORT}`));
}

startServer().catch(err => { console.error('Server startup failed:', err.message); process.exit(1); });
