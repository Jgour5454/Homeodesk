const JsonStore = require('./jsonStore');

const store = new JsonStore('doctors.json');

function listDoctors() {
  return store.findAll();
}

function findDoctorById(id) {
  if (!id) return null;
  return store.findById(id);
}

/**
 * Works out which doctor a new appointment/consultation should be assigned to.
 * This always reads from the doctors "table" in the database rather than
 * hardcoding an id anywhere in route logic:
 *  - requestedId supplied and matches a real doctor -> that doctor's id
 *  - requestedId supplied but doesn't match any doctor -> undefined (caller
 *    should surface this as a validation error)
 *  - requestedId omitted -> the clinic's first registered doctor is used
 *    (today that's the only doctor; if more doctors are added later this
 *    keeps working without any code changes)
 *  - no doctors registered at all -> null
 */
function resolveDoctorId(requestedId) {
  if (requestedId) {
    const doctor = findDoctorById(requestedId);
    return doctor ? doctor.id : undefined;
  }
  const [first] = listDoctors();
  return first ? first.id : null;
}

/**
 * Adds a public doctor profile (id/name/email — no password data) to the
 * doctors "table" when a new doctor account is registered, so the booking
 * flow and doctor lookups immediately pick them up.
 */
function createDoctorProfile({ id, name, email }) {
  return store.create({ id, name, email });
}

module.exports = {
  listDoctors,
  findDoctorById,
  resolveDoctorId,
  createDoctorProfile,
};
