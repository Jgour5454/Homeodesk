# 🌿 Homeo Desk – Homeopathy Clinic Portal

A complete React.js web application for Homeo Desk Clinic.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher) → https://nodejs.org
- npm (comes with Node.js)

### Run the App (frontend + backend)

The **Book an Appointment** and **Online Consultation** forms now save to a real backend
API instead of just showing a fake success message. You need to run both the backend
and the frontend, in two terminals:

```bash
# Terminal 1 — Backend API (http://localhost:5000)
cd server
npm install
cp .env.example .env       # then edit .env — see "Doctor login" below
npm start

# Terminal 2 — Frontend (http://localhost:3000)
npm install
npm start
```

The app opens automatically at → **http://localhost:3000**, and the frontend talks to
the API at `http://localhost:5000/api` by default. To point the frontend at a different
API URL (e.g. once deployed), create a `.env` file in the project root:

```
REACT_APP_API_URL=https://your-api-domain.com/api
```

See [`server/README.md`](./server/README.md) for full API documentation.

---

## 🔑 Login

The clinic has exactly one, fixed doctor account — **static** in the sense
that it can never be created, duplicated, or self-registered through the app.
There is **no** hardcoded "any password works" shortcut anywhere — the doctor
logs in through the same real, password-checked API as every patient, with
hashed passwords (scrypt), signed session tokens (JWT), and rate-limited
login attempts. See
[`server/README.md`](./server/README.md#authentication--apiauth) for details.

### Setting up the doctor account (do this once)

**Recommended** — set these three lines in `server/.env` (copy from
`server/.env.example`):

```
DOCTOR_EMAIL=ishakhimani45@doctor.in
DOCTOR_NAME=Dr. Isha Khimani
DOCTOR_PASSWORD=pick-a-real-password-min-8-chars
```

The server creates/confirms this account **automatically every time it
starts** — no command to remember, and it keeps working even if
`server/data/*.json` gets wiped (which is what actually breaks login on most
hosts: that folder is gitignored on purpose, so a fresh deploy has no doctor
account until something re-creates it). As long as your host keeps your `.env`
values across restarts/redeploys — which every host does, that's what env
vars are for — login just works, every time, with no manual step.

If you'd rather not put the password in `.env`, the old interactive script
still works exactly as before (note: this **won't** survive a redeploy on a
host with an ephemeral filesystem, since it only writes to the local JSON
file, not to `.env`):

```bash
cd server
npm run seed:doctor -- "ishakhimani45@doctor.in" "Dr. Isha Khimani"
```

| Role    | Email                    | Password |
|---------|---------------------------|----------|
| Doctor  | ishakhimani45@doctor.in   | whatever you set as `DOCTOR_PASSWORD` (or via `npm run seed:doctor`) |
| Patient | patient@homeodesk.in      | patient123 *(demo account — change/remove before going live)* |

---

## ✨ Features

### 🌐 Public Website
- Hero section with Dr. Isha Khimani intro
- Service listings (Chronic care, Pediatrics, Women's health, etc.)
- Online consultation booking form
- Appointment booking form
- Diet plans & nutrition guide
- Patient feedback / testimonials

### 👩‍⚕️ Doctor Portal
- Dashboard with stats & today's schedule
- Manage appointments (confirm / add notes / video link)
- Patient records with constitutional profiling & visit history
- Create & assign personalized diet plans
- View patient feedback & ratings

### 🧑‍💼 Patient Portal
- Dashboard with upcoming appointments & active diet plan
- Book online or in-clinic appointments
- View appointment history with doctor notes
- Personal diet plan (meals, avoid list, lifestyle tips)
- Health records (constitutional profile, visit history)
- Submit feedback with star rating

---

## 🗂️ Project Structure

```
homeodesk/
├── public/
│   └── index.html
├── src/
│   ├── App.js        ← All components in one file
│   ├── api.js         ← Frontend API client (talks to /server)
│   └── index.js
├── server/             ← Backend API (Express)
│   ├── index.js
│   ├── routes/
│   │   ├── appointments.js
│   │   └── consultations.js
│   ├── utils/
│   │   ├── jsonStore.js
│   │   └── validate.js
│   ├── data/           ← JSON "database" files (created automatically)
│   └── README.md
├── package.json
└── README.md
```

## 🧩 What's now backed by the API

| Page                              | Behavior |
|------------------------------------|----------|
| Public → Book an Appointment       | Submits to `POST /api/appointments`, validated server-side, persisted, shows real success/error message |
| Public → Online Consultation       | Submits to `POST /api/consultations`, validated server-side, persisted |
| Patient Portal → Online Consult tab| Submits to `POST /api/appointments` with the logged-in patient's ID attached |
| Login / Register                   | Submits to `POST /api/auth/login` or `POST /api/auth/register`; passwords are hashed server-side, sessions use a signed token, and role redirects (doctor/patient dashboard) happen based on the account's real role |
| Doctor Portal → Appointments        | Fetches live from `GET /api/appointments` and `GET /api/consultations` (filtered to the doctor's own bookings), merges both into one list, and lets the doctor confirm/complete/cancel or add a meeting link via `PATCH` |
| Doctor Portal → Patients / Records  | Fetches the doctor's real patient roster from `GET /api/records/patients/list` and lets the doctor add/edit/delete each patient's visit records via the secured `/api/records` endpoints |
| Patient Portal → My Records         | Fetches the logged-in patient's own visit records from `GET /api/records` |
| Doctor Portal → Diet Plans          | Doctor creates, edits, and deletes real diet plans assigned to a specific patient via the secured `/api/diet-plans` endpoints |
| Patient Portal → Diet Plan          | Fetches the plan(s) assigned by the doctor from `GET /api/diet-plans` and shows the active one — no plan assigned yet shows an empty state instead of sample data |

Constitutional profiles and feedback still use sample data — those weren't
part of this backend work.
