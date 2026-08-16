require('dotenv').config();
const connectDB = require('../config/db');
const bootstrapDoctor = require('../utils/bootstrapDoctor');

(async () => {
  try {
    await connectDB();
    await bootstrapDoctor();
    await require('mongoose').disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
