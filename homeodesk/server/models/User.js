const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    role: {
      type: String,
      enum: ["doctor", "patient"],
      default: "patient",
      required: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordCode: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);