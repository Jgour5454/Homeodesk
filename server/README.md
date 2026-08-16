# HomeoDesk API

The backend is MongoDB-only at runtime. Authentication, doctors, appointments, consultations, clinical records, diet plans, feedback, and password-reset state are stored in MongoDB through Mongoose.

## Environment

Copy `.env.example` to `.env` and set:

- `MONGODB_URI` — exact MongoDB Atlas connection string
- `JWT_SECRET` — long random secret
- `DOCTOR_EMAIL`, `DOCTOR_NAME`, `DOCTOR_PASSWORD` — fixed doctor account
- `FRONTEND_ORIGIN` — optional comma-separated frontend origins
- SMTP variables — optional, for real password-reset emails

Do not commit `.env`.

## Commands

```bash
npm install
npm run seed:doctor
npm start
```

If this project contains legacy JSON data in `migrations/legacy-data`, migrate it once after configuring MongoDB:

```bash
npm run migrate:legacy
```

The API never reads the legacy JSON files during normal operation.

## Important MongoDB URI note

The old archive contained a concrete Atlas URI. It has intentionally not been copied into the corrected archive because it exposed a database credential. Create/rotate the Atlas database password and put the newly generated URI in your deployment environment. If the password contains characters such as `@`, `:`, `/`, `?`, or `#`, URL-encode them.
