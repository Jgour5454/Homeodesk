# HomeoDesk API

Backend for the **Book an Appointment** and **Online Consultation** pages.

Small Express API with a lightweight JSON-file data store (no native DB driver to
install — great for getting this running anywhere quickly). Swapping the store for
MongoDB/Postgres later only touches `utils/jsonStore.js` and the two route files, not
the frontend.

## Run it

```bash
cd server
npm install
npm start          # http://localhost:5000
# or for auto-reload during development:
npm run dev
```

Copy `.env.example` to `.env` — at minimum set your own `JWT_SECRET` (a fallback dev
secret is used if you skip this, but never rely on that outside local dev).

## Data

Records are stored as JSON in `server/data/appointments.json`,
`server/data/consultations.json`, and `server/data/users.json` (auto-created on first
run). Fine for local dev/demo; back these up or migrate to a real database before
production use.

## Authentication — `/api/auth`

Every login — doctor included — goes through this real API. There is no
client-side "any password works" shortcut anywhere in the app.

The clinic has exactly one, fixed doctor account (`ishakhimani45@doctor.in`).
It's **not** created through `/api/auth/register` — that endpoint only ever
issues **patient** accounts and rejects any request that passes a non-patient
role.

**Recommended setup — automatic, survives every restart/redeploy:** set
`DOCTOR_EMAIL`, `DOCTOR_NAME`, and `DOCTOR_PASSWORD` in `.env` (see
`.env.example`). `server/utils/bootstrapDoctor.js` runs on every server
start and creates the account if it's missing, or syncs its password if it
already exists — so login always works with whatever is in `.env`, even on
hosts that wipe `server/data/*.json` on every deploy (it's gitignored on
purpose, since it's local data, not something to commit).

**Manual alternative:** if you'd rather not put a password in `.env`, seed it
directly on the server instead:

```bash
cd server
npm run seed:doctor -- "ishakhimani45@doctor.in" "Dr. Isha Khimani"
# you'll be prompted for a password (input hidden, min. 8 characters)
```

This only writes to the local `data/users.json`, so on a host with an
ephemeral filesystem you'd need to re-run it after every redeploy — the
`.env` approach above doesn't have that problem, so it's the better default
unless you have a specific reason to avoid it.

Either way, the doctor's `id` (`'1'`) matches the row in `data/doctors.json`
so appointment/consultation `doctorId` filtering keeps working correctly.

All passwords — doctor and patient alike — are hashed with Node's built-in
`scrypt` KDF (`server/utils/password.js`, random salt per user) and are never
stored or logged in plain text. Login/registration issue a signed JWT (7-day
expiry) that the frontend stores and sends back as
`Authorization: Bearer <token>` on every request to restore the session and
prove who's calling. `POST /api/auth/login` is rate-limited per IP+email
(`server/middleware/rateLimit.js`) to slow down password guessing.

| Method | Path              | Description |
|--------|-------------------|--------------|
| POST   | `/api/auth/register` | Create a **patient** account. Body: `{ name, email, password, phone? }`. Returns `{ token, user }`. |
| POST   | `/api/auth/login`    | Log in (patient or doctor). Body: `{ email, password }`. Returns `{ token, user }`. Rate-limited. |
| GET    | `/api/auth/me`       | Returns the current logged-in user for a valid `Authorization: Bearer <token>` header. Used to restore a session on page load. |

Demo patient account (for trying out the patient portal):

| Role    | Email                 | Password    | Backed by |
|---------|------------------------|-------------|-----------|
| Patient | patient@homeodesk.in   | patient123  | `data/users.json` |

The doctor account has no default password — it only exists after you run
`npm run seed:doctor` yourself, so no real credential ships in this repo.

## Endpoints

Doctor-only actions below (marked 🔒) require a valid
`Authorization: Bearer <token>` for a **doctor**-role user, and are scoped to
that doctor's own records (`server/middleware/auth.js`). A missing/invalid
token gets `401`; a valid token for the wrong role, or for a different
doctor's data, gets `403`.

### Appointments — `/api/appointments`
Used by the **Book an Appointment** page and the patient portal's booking form.

| Method | Path                  | Description |
|--------|------------------------|--------------|
| POST   | `/api/appointments`    | Create an appointment request |
| GET    | `/api/appointments`    | List. Filters: `?phone=`, `?email=`, `?patientId=`, `?status=`, `?doctorId=` 🔒 (only `?doctorId=` requires doctor auth) |
| GET    | `/api/appointments/:id`| Get one appointment |
| PATCH  | `/api/appointments/:id`| 🔒 Update `status`, `notes`, `meetingLink`, `date`, `timeSlot` |
| DELETE | `/api/appointments/:id`| Cancel (soft — sets `status: 'cancelled'`) |

**POST body:**
```json
{
  "firstName": "Arjun",
  "lastName": "Sharma",
  "phone": "+91 98765 43210",
  "email": "arjun@email.com",
  "date": "2026-08-10",
  "timeSlot": "10:00 AM",
  "type": "in-clinic",
  "concern": "Migraine and headaches",
  "patientId": "optional-logged-in-patient-id"
}
```

### Online Consultations — `/api/consultations`
Used by the **Online Consultation** page.

| Method | Path                     | Description |
|--------|---------------------------|--------------|
| POST   | `/api/consultations`      | Create a consultation request |
| GET    | `/api/consultations`      | List. Filters: `?phone=`, `?email=`, `?patientId=`, `?status=`, `?doctorId=` 🔒 (only `?doctorId=` requires doctor auth) |
| GET    | `/api/consultations/:id`  | Get one |
| PATCH  | `/api/consultations/:id`  | 🔒 Update `status`, `meetingLink`, `date`, `timeSlot` |
| DELETE | `/api/consultations/:id`  | Cancel |

**POST body:**
```json
{
  "name": "Priya Mehta",
  "phone": "9876543210",
  "email": "priya@email.com",
  "date": "2026-08-11",
  "timeSlot": "9:00 AM – 10:00 AM",
  "concern": "Hormonal imbalance"
}
```

### Patient Records — `/api/records`
Clinical visit records. This is PHI, so **every** route here requires a valid
session (no anonymous access at all) and results are always scoped to "your
own" data — a patient only ever sees their own records; a doctor only ever
sees/writes/edits/deletes records they personally authored.

| Method | Path                          | Description |
|--------|--------------------------------|--------------|
| POST   | `/api/records`                 | 🔒 Doctor only. Create a visit record for a real patient account |
| GET    | `/api/records`                 | List. Patient → their own; Doctor → records they authored, optionally `?patientId=` |
| GET    | `/api/records/patients/list`   | 🔒 Doctor only. This doctor's patient roster, built from their own appointments/consultations/records |
| GET    | `/api/records/:id`             | Get one — only the owning patient or the authoring doctor |
| PATCH  | `/api/records/:id`              | 🔒 Doctor only, and only over records they authored |
| DELETE | `/api/records/:id`              | 🔒 Doctor only, and only over records they authored |

**POST body:** `{ patientId, visitDate, chiefComplaint, diagnosis?, remedy, potency?, notes?, followUpDate? }`

### Diet Plans — `/api/diet-plans`
Doctor-created nutrition/lifestyle plans assigned to a specific patient, shown
on that patient's dashboard once saved. Same access model as records: every
route requires a valid session, a patient only ever sees plans assigned to
them, and a doctor only ever sees/writes/edits/deletes plans they authored.

| Method | Path                    | Description |
|--------|--------------------------|--------------|
| POST   | `/api/diet-plans`        | 🔒 Doctor only. Create & assign a plan to a real patient account |
| GET    | `/api/diet-plans`        | List. Patient → plans assigned to them; Doctor → plans they authored, optionally `?patientId=` |
| GET    | `/api/diet-plans/:id`    | Get one — only the assigned patient or the authoring doctor |
| PATCH  | `/api/diet-plans/:id`    | 🔒 Doctor only, and only over plans they authored |
| DELETE | `/api/diet-plans/:id`    | 🔒 Doctor only, and only over plans they authored |

**POST body:**
```json
{
  "patientId": "the-patient's-account-id",
  "title": "Anti-Inflammatory Diet",
  "condition": "Arthritis, Chronic Pain",
  "breakfast": "Oatmeal with berries\nWarm ginger tea",
  "lunch": "Brown rice\nMoong dal",
  "dinner": "Khichdi\nSalad",
  "foodsToInclude": "Turmeric, Ginger, Leafy greens",
  "foodsToAvoid": "Refined sugar, Fried foods",
  "hydration": "8–10 glasses of water daily",
  "lifestyle": "Sleep 7–8 hrs\nMorning walk 20 min",
  "notes": "Optional additional notes",
  "status": "active"
}
```
`breakfast`/`lunch`/`dinner`/`foodsToInclude`/`foodsToAvoid`/`lifestyle` each accept
either a newline/comma-separated string or a plain array — both are normalized
to a clean array server-side.

### Health check
`GET /api/health` → `{ ok: true, service: 'homeodesk-api', time: ... }`

## Validation & errors

All POST/PATCH bodies are validated server-side (required fields, phone/email format,
date not in the past, time slot from the allowed list, valid appointment `type`).
Invalid requests return `400` with an `errors` object keyed by field:

```json
{ "ok": false, "errors": { "phone": "A valid phone number is required." } }
```

Successful writes return `201`/`200` with `{ ok: true, ... }`.
