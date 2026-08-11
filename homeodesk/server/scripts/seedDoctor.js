const User = require("../models/User");
const { hashPassword } = require("./password");

const bootstrapDoctor = async () => {
  try {
    const email = process.env.DOCTOR_EMAIL?.trim().toLowerCase();
    const name = process.env.DOCTOR_NAME?.trim();
    const password = process.env.DOCTOR_PASSWORD;

    if (!email || !name || !password) {
      throw new Error(
        "Missing DOCTOR_EMAIL, DOCTOR_NAME, or DOCTOR_PASSWORD environment variable."
      );
    }

    if (!email.endsWith("@doctor.in")) {
      throw new Error("DOCTOR_EMAIL must be a valid @doctor.in address.");
    }

    if (password.length < 8) {
      throw new Error("DOCTOR_PASSWORD must be at least 8 characters.");
    }

    const passwordHash = hashPassword(password);

    let doctor = await User.findOne({ email });

    if (doctor) {
      doctor.name = name;
      doctor.role = "doctor";
      doctor.passwordHash = passwordHash;

      await doctor.save();

      console.log(
        `Doctor account (${email}) confirmed and password synchronized from environment.`
      );

      return doctor;
    }

    doctor = await User.create({
      id: "1",
      name,
      email,
      phone: "",
      role: "doctor",
      passwordHash
    });

    console.log(`Doctor account (${email}) created in MongoDB.`);

    return doctor;
  } catch (error) {
    console.error("Doctor bootstrap failed:");
    console.error(error.message);
    throw error;
  }
};

module.exports = {
  bootstrapDoctor
};