const PHONE_RE = /^[+]?[\d\s-]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Doctor accounts are restricted to the clinic's @doctor.in domain; patients
// can register with any valid email address.
const DOCTOR_EMAIL_RE = /^[^\s@]+@doctor\.in$/i;
const ROLES = ['doctor', 'patient'];
const TIME_SLOTS = [
  '9:00 AM', '9:00 AM – 10:00 AM',
  '10:00 AM',
  '11:00 AM', '11:00 AM – 12:00 PM',
  '12:00 PM',
  '4:00 PM', '4:00 PM – 5:00 PM',
  '5:00 PM',
  '6:00 PM', '6:00 PM – 7:00 PM',
];
const APPOINTMENT_TYPES = ['in-clinic', 'online', 'follow-up'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidPhone(v) {
  return isNonEmptyString(v) && PHONE_RE.test(v.trim());
}

function isValidEmail(v) {
  // email is optional in some flows, so only validate when present
  return !v || EMAIL_RE.test(String(v).trim());
}

function isStrictValidEmail(v) {
  // email is required (used for auth, where an email is mandatory)
  return isNonEmptyString(v) && EMAIL_RE.test(v.trim());
}

function isValidDoctorEmail(v) {
  return isNonEmptyString(v) && DOCTOR_EMAIL_RE.test(v.trim());
}

function isValidRole(v) {
  return ROLES.includes(v);
}

function isValidDate(v) {
  if (!isNonEmptyString(v)) return false;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  // must not be in the past (compare by calendar day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

function isValidTimeSlot(v) {
  return isNonEmptyString(v) && TIME_SLOTS.includes(v.trim());
}

// Used for clinical record dates (visit date, follow-up date). Unlike
// isValidDate (booking dates, which must be upcoming), a visit record is
// usually logged for today or a past date, so this only checks that the
// value parses to a real calendar date — no past/future restriction.
function isValidAnyDate(v) {
  if (!isNonEmptyString(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

function isValidType(v) {
  return APPOINTMENT_TYPES.includes(v);
}

module.exports = {
  isNonEmptyString,
  isValidPhone,
  isValidEmail,
  isStrictValidEmail,
  isValidDoctorEmail,
  isValidRole,
  isValidDate,
  isValidAnyDate,
  isValidTimeSlot,
  isValidType,
  TIME_SLOTS,
  APPOINTMENT_TYPES,
  ROLES,
};
