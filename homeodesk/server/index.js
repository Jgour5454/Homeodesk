require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const bootstrapDoctor = require('./utils/bootstrapDoctor');

const appointmentsRouter = require('./routes/appointments');
const consultationsRouter = require('./routes/consultations');
const doctorsRouter = require('./routes/doctors');
const authRouter = require('./routes/auth');
const recordsRouter = require('./routes/records');
const dietPlansRouter = require('./routes/dietPlans');
const feedbackRouter = require('./routes/feedback');

const app = express();
const PORT = process.env.PORT || 5000;


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors());
app.use(express.json());


// Simple request log
app.use((req, res, next) => {
    console.log(
        `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
    );
    next();
});


// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        service: 'homeodesk-api',
        time: new Date().toISOString()
    });
});


// ======================================================
// ROUTES
// ======================================================

app.use('/api/auth', authRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/consultations', consultationsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/records', recordsRouter);
app.use('/api/diet-plans', dietPlansRouter);
app.use('/api/feedback', feedbackRouter);


// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {
    res.status(404).json({
        ok: false,
        error: 'Not found.'
    });
});


// ======================================================
// CENTRAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        ok: false,
        error: 'Something went wrong on the server.'
    });
});


// ======================================================
// START SERVER
// ======================================================

const startServer = async () => {
    try {

        // 1. Connect MongoDB
        await connectDB();

        // 2. Create/update doctor in MongoDB
        await bootstrapDoctor();

        // 3. Start Express
        app.listen(PORT, () => {
            console.log(
                `HomeoDesk API running on port ${PORT}`
            );
        });

    } catch (error) {

        console.error(
            "Server startup failed:",
            error
        );

        process.exit(1);
    }
};


startServer();