const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");

const {
  hashPassword,
  verifyPassword,
} = require("../utils/password");

const {
  isNonEmptyString,
  isStrictValidEmail,
  isValidDoctorEmail,
} = require("../utils/validate");

const {
  loginRateLimit,
  clearRateLimit,
} = require("../middleware/rateLimit");

const {
  sendPasswordResetEmail,
} = require("../utils/email");

const {
  saveResetCode,
  getResetCode,
} = require("../utils/resetCodeStore");

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

const TOKEN_TTL = "7d";

if (!process.env.JWT_SECRET) {
  console.warn(
    "JWT_SECRET is not set in .env — using insecure default."
  );
}


/* =========================================================
   HELPERS
========================================================= */

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_TTL,
    }
  );
}


function publicUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };

  delete obj.passwordHash;

  return obj;
}


/* =========================================================
   REGISTER PATIENT
   POST /api/auth/register
========================================================= */

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
    } = req.body || {};

    const errors = {};

    /*
      Patients can register themselves.
      Doctor accounts are created from .env.
    */

    if (role !== undefined && role !== "patient") {
      return res.status(403).json({
        ok: false,
        error:
          "Doctor accounts are fixed and cannot be created through public registration.",
      });
    }

    const configuredDoctorEmail = String(
      process.env.DOCTOR_EMAIL || ""
    )
      .trim()
      .toLowerCase();

    const candidateEmail = String(email || "")
      .trim()
      .toLowerCase();

    /*
      Prevent patient from registering with doctor email.
    */

    if (
      isNonEmptyString(email) &&
      (
        isValidDoctorEmail(email) ||
        (
          configuredDoctorEmail &&
          candidateEmail === configuredDoctorEmail
        )
      )
    ) {
      return res.status(403).json({
        ok: false,
        error:
          "This email is reserved for the doctor account.",
      });
    }


    /* Validation */

    if (!isNonEmptyString(name)) {
      errors.name = "Full name is required.";
    }

    if (!isStrictValidEmail(email)) {
      errors.email = "A valid email address is required.";
    }

    if (
      !isNonEmptyString(password) ||
      String(password).length < 6
    ) {
      errors.password =
        "Password must be at least 6 characters.";
    }


    if (Object.keys(errors).length) {
      return res.status(400).json({
        ok: false,
        errors,
      });
    }


    /* Check MongoDB for existing user */

    const existingUser = await User.findOne({
      email: candidateEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        ok: false,
        errors: {
          email:
            "An account with this email already exists.",
        },
      });
    }


    /* Create patient */

    const user = await User.create({
      name: name.trim(),

      email: candidateEmail,

      phone: phone
        ? String(phone).trim()
        : "",

      role: "patient",

      passwordHash: hashPassword(password),
    });


    /* Login immediately after registration */

    const token = signToken(user);

    return res.status(201).json({
      ok: true,
      token,
      user: publicUser(user),
    });

  } catch (error) {

    console.error(
      "Registration error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Registration failed.",
    });
  }
});


/* =========================================================
   LOGIN
   POST /api/auth/login
========================================================= */

router.post(
  "/login",
  loginRateLimit,
  async (req, res) => {

    try {

      const {
        email,
        password,
      } = req.body || {};


      if (
        !isStrictValidEmail(email) ||
        !isNonEmptyString(password)
      ) {
        return res.status(400).json({
          ok: false,
          errors: {
            email:
              "Email and password are required.",
          },
        });
      }


      const normalizedEmail = String(email)
        .trim()
        .toLowerCase();


      /*
        Find user in MongoDB
      */

      const user = await User.findOne({
        email: normalizedEmail,
      });


      /*
        Check password
      */

      if (
        !user ||
        !verifyPassword(
          password,
          user.passwordHash
        )
      ) {

        return res.status(401).json({
          ok: false,
          error:
            "Invalid email or password.",
        });
      }


      /*
        Protect doctor account
      */

      const configuredDoctorEmail = String(
        process.env.DOCTOR_EMAIL || ""
      )
        .trim()
        .toLowerCase();


      const isDoctorAccount =
        configuredDoctorEmail &&
        normalizedEmail === configuredDoctorEmail;


      /*
        Doctor email must have doctor role
      */

      if (
        isDoctorAccount &&
        user.role !== "doctor"
      ) {

        return res.status(403).json({
          ok: false,
          error:
            "Doctor account is incorrectly configured.",
        });
      }


      /*
        Doctor domain must also be doctor
      */

      if (
        isValidDoctorEmail(user.email) &&
        user.role !== "doctor"
      ) {

        return res.status(403).json({
          ok: false,
          error:
            "Doctor account is incorrectly configured.",
        });
      }


      clearRateLimit(req);


      const token = signToken(user);


      return res.json({
        ok: true,
        token,
        user: publicUser(user),
      });

    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error: "Login failed.",
      });
    }
  }
);


/* =========================================================
   CURRENT USER
   GET /api/auth/me
========================================================= */

router.get("/me", async (req, res) => {

  try {

    const header =
      req.headers.authorization || "";

    const token =
      header.startsWith("Bearer ")
        ? header.slice(7)
        : null;


    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Missing token.",
      });
    }


    const payload =
      jwt.verify(token, JWT_SECRET);


    const user =
      await User.findById(payload.sub);


    if (!user) {
      return res.status(401).json({
        ok: false,
        error:
          "User no longer exists.",
      });
    }


    return res.json({
      ok: true,
      user: publicUser(user),
    });

  } catch (error) {

    return res.status(401).json({
      ok: false,
      error:
        "Invalid or expired token.",
    });
  }
});


/* =========================================================
   FORGOT PASSWORD
========================================================= */

router.post(
  "/forgot-password",
  async (req, res) => {

    try {

      const { email } =
        req.body || {};


      if (!isStrictValidEmail(email)) {
        return res.status(400).json({
          ok: false,
          errors: {
            email:
              "A valid email address is required.",
          },
        });
      }


      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();


      const user =
        await User.findOne({
          email: normalizedEmail,
        });


      /*
        Don't reveal whether email exists.
      */

      if (!user) {

        return res.json({
          ok: true,
          message:
            "If an account with that email exists, password reset instructions have been sent.",
        });
      }


      const otpCode =
        Math.floor(
          100000 +
          Math.random() * 900000
        ).toString();


      const resetToken =
        crypto
          .randomBytes(16)
          .toString("hex");


      const resetExpires =
        Date.now() + 3600000;


      /*
        Store reset data in MongoDB
      */

      user.resetPasswordToken =
        resetToken;

      user.resetPasswordCode =
        otpCode;

      user.resetPasswordExpires =
        resetExpires;

      await user.save();


      /*
        Keep your existing reset-code system
        for now.
      */

      saveResetCode(
        user.email,
        otpCode,
        resetExpires
      );


      await sendPasswordResetEmail(
        user.email,
        otpCode
      );


      return res.json({
        ok: true,
        message:
          "A 6-digit password reset code has been sent to your email address.",
      });

    } catch (error) {

      console.error(
        "Forgot password error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to process password reset.",
      });
    }
  }
);


/* =========================================================
   LATEST RESET CODE
========================================================= */

router.get(
  "/latest-reset-code",
  (req, res) => {

    const { email } =
      req.query || {};


    if (!email) {
      return res.status(400).json({
        ok: false,
        error:
          "Email query parameter is required.",
      });
    }


    const entry =
      getResetCode(email);


    if (!entry) {
      return res.status(404).json({
        ok: false,
        error:
          "No active reset code found.",
      });
    }


    return res.json({
      ok: true,
      email: entry.email,
      code: entry.code,
      expiresAt:
        new Date(
          entry.expiresAt
        ).toISOString(),
      status: entry.status,
      databaseFile:
        "MongoDB users collection",
    });
  }
);


/* =========================================================
   VERIFY RESET CODE
========================================================= */

router.post(
  "/verify-code",
  async (req, res) => {

    try {

      const {
        email,
        code,
      } = req.body || {};


      if (!isNonEmptyString(code)) {
        return res.status(400).json({
          ok: false,
          error:
            "Verification code is required.",
        });
      }


      const codeStr =
        String(code).trim();


      let user = null;


      if (
        email &&
        isStrictValidEmail(email)
      ) {

        user =
          await User.findOne({
            email:
              String(email)
                .trim()
                .toLowerCase(),
          });
      }


      if (!user) {

        user =
          await User.findOne({
            $or: [
              {
                resetPasswordToken:
                  codeStr,
              },
              {
                resetPasswordCode:
                  codeStr,
              },
            ],
          });
      }


      if (!user) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid verification code.",
        });
      }


      const matches =
        user.resetPasswordCode ===
          codeStr ||
        user.resetPasswordToken ===
          codeStr;


      if (!matches) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid verification code.",
        });
      }


      if (
        !user.resetPasswordExpires ||
        Date.now() >
          user.resetPasswordExpires
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Verification code has expired.",
        });
      }


      return res.json({
        ok: true,
        message:
          "Code verified successfully.",
      });

    } catch (error) {

      console.error(
        "Verify code error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to verify code.",
      });
    }
  }
);


/* =========================================================
   RESET PASSWORD
========================================================= */

router.post(
  "/reset-password",
  async (req, res) => {

    try {

      const {
        email,
        resetToken,
        newPassword,
      } = req.body || {};


      const errors = {};


      if (!isNonEmptyString(resetToken)) {
        errors.resetToken =
          "Reset token or 6-digit code is required.";
      }


      if (
        !isNonEmptyString(newPassword) ||
        String(newPassword).length < 6
      ) {
        errors.newPassword =
          "New password must be at least 6 characters.";
      }


      if (Object.keys(errors).length) {
        return res.status(400).json({
          ok: false,
          errors,
        });
      }


      const tokenStr =
        String(resetToken).trim();


      let user = null;


      if (
        email &&
        isStrictValidEmail(email)
      ) {

        user =
          await User.findOne({
            email:
              String(email)
                .trim()
                .toLowerCase(),
          });
      }


      if (!user) {

        user =
          await User.findOne({
            $or: [
              {
                resetPasswordToken:
                  tokenStr,
              },
              {
                resetPasswordCode:
                  tokenStr,
              },
            ],
          });
      }


      if (!user) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid or expired password reset token.",
        });
      }


      const tokenMatches =
        user.resetPasswordToken ===
          tokenStr ||
        user.resetPasswordCode ===
          tokenStr;


      if (!tokenMatches) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid password reset code or token.",
        });
      }


      if (
        !user.resetPasswordExpires ||
        Date.now() >
          user.resetPasswordExpires
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Password reset token has expired.",
        });
      }


      user.passwordHash =
        hashPassword(newPassword);

      user.resetPasswordToken = null;
      user.resetPasswordCode = null;
      user.resetPasswordExpires = null;


      await user.save();


      return res.json({
        ok: true,
        message:
          "Your password has been successfully reset! You can now log in with your new password.",
      });

    } catch (error) {

      console.error(
        "Reset password error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to reset password.",
      });
    }
  }
);


module.exports = router;