const User = require("../models/User");
const { hashPassword } = require("./password");

async function bootstrapDoctor() {
  const email = String(
    process.env.DOCTOR_EMAIL || ""
  )
    .trim()
    .toLowerCase();

  const name = String(
    process.env.DOCTOR_NAME || "Doctor"
  ).trim();

  const password =
    process.env.DOCTOR_PASSWORD || "";


  if (!email || !password) {
    throw new Error(
      "DOCTOR_EMAIL and DOCTOR_PASSWORD must be configured in server/.env"
    );
  }


  let doctor =
    await User.findOne({ email });


  if (!doctor) {

    doctor = await User.create({
      name,
      email,
      phone: "",
      role: "doctor",
      passwordHash:
        hashPassword(password),
    });

    console.log(
      `Doctor account (${email}) created in MongoDB.`
    );

  } else {

    /*
      Ensure existing account is a doctor.
    */

    doctor.role = "doctor";
    doctor.name = name;

    /*
      Keep the .env password synchronized.
    */

    doctor.passwordHash =
      hashPassword(password);

    await doctor.save();

    console.log(
      `Doctor account (${email}) confirmed and password synchronized from .env.`
    );
  }


  return doctor;
}


module.exports = bootstrapDoctor;