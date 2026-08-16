/* ─────────────────────────────────────────────
   API CLIENT
   Talks to the HomeoDesk backend (see /server).
   Set REACT_APP_API_URL in a .env file to point at a
   deployed API; defaults to localhost for development.
───────────────────────────────────────────── */
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  // Attach the saved session token, if any, so doctor-only endpoints (which
  // now require real server-side auth — see server/middleware/auth.js) work
  // automatically once the user is logged in. A plain 401 from the API is
  // what happens if it's missing or expired; callers already handle that.
  const token = localStorage.getItem('hd_token');

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
  } catch (err) {
    // Network-level failure (server down, CORS, offline, etc.)
    const error = new Error('Could not reach the server. Please check your connection and try again.');
    error.cause = err;
    throw error;
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty/non-JSON body */ }

  if (!res.ok || !data || data.ok === false) {
    const error = new Error((data && (data.error || summarizeErrors(data.errors))) || `Request failed (${res.status})`);
    error.status = res.status;
    error.errors = data && data.errors;
    throw error;
  }

  return data;
}

function summarizeErrors(errors) {
  if (!errors) return null;
  const first = Object.values(errors)[0];
  return first || 'Please check the form and try again.';
}

/* Auth — Doctor & Patient login/register (backed by the users DB) */
export const registerUser = (payload) => request('/auth/register', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const loginUser = (payload) => request('/auth/login', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const fetchCurrentUser = (token) => request('/auth/me', {
  headers: { Authorization: `Bearer ${token}` },
});

export const forgotPassword = (payload) => request('/auth/forgot-password', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const verifyResetCode = (payload) => request('/auth/verify-code', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const resetPassword = (payload) => request('/auth/reset-password', {
  method: 'POST',
  body: JSON.stringify(payload),
});

/* Appointments — "Book an Appointment" page */
export const createAppointment = (payload) => request('/appointments', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const getAppointments = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/appointments${qs ? `?${qs}` : ''}`);
};

export const updateAppointment = (id, patch) => request(`/appointments/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(patch),
});

export const cancelAppointment = (id) => request(`/appointments/${id}`, { method: 'DELETE' });

/* Online Consultations — "Online Consultation" page */
export const createConsultation = (payload) => request('/consultations', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const getConsultations = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/consultations${qs ? `?${qs}` : ''}`);
};

export const updateConsultation = (id, patch) => request(`/consultations/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(patch),
});

export const cancelConsultation = (id) => request(`/consultations/${id}`, { method: 'DELETE' });

/* Doctors — dynamic lookup, no hardcoded doctor data on the frontend */
export const getDoctors = () => request('/doctors');

/* Patient Records — clinical visit records (secured, full CRUD).
   Patients are always scoped server-side to their own records; doctors are
   always scoped server-side to records they personally authored. */
export const createRecord = (payload) => request('/records', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const getRecords = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/records${qs ? `?${qs}` : ''}`);
};

export const getRecord = (id) => request(`/records/${id}`);

export const updateRecord = (id, patch) => request(`/records/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(patch),
});

export const deleteRecord = (id) => request(`/records/${id}`, { method: 'DELETE' });

/* This doctor's own patient roster — never the full user table */
export const getMyPatients = () => request('/records/patients/list');

/* Diet Plans — doctor-created nutrition plans assigned to a patient (secured,
   full CRUD). Patients are always scoped server-side to plans assigned to
   them; doctors are always scoped server-side to plans they authored. */
export const createDietPlan = (payload) => request('/diet-plans', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const getDietPlans = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/diet-plans${qs ? `?${qs}` : ''}`);
};

export const getDietPlan = (id) => request(`/diet-plans/${id}`);

export const updateDietPlan = (id, patch) => request(`/diet-plans/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(patch),
});

export const deleteDietPlan = (id) => request(`/diet-plans/${id}`, { method: 'DELETE' });

/* Feedback — patient reviews, secured. Patients can only submit/see their
   own; doctors see every review addressed to them, straight from the DB. */
export const submitFeedback = (payload) => request('/feedback', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const getFeedback = () => request('/feedback');


export const sendChatbotMessage = (message, history = []) =>
  request('/chatbot', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history,
    }),
  });
