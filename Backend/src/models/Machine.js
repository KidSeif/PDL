const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      default: "Factory Floor",
    },
    currentStatus: {
      type: String,
      enum: ["NORMAL", "ALERT", "FAILURE_PROBABLE"],
      default: "NORMAL",
    },
    thresholds: {
      temperatureWarning: { type: Number, default: 60 },
      temperatureCritical: { type: Number, default: 75 },
      vibrationWarning: { type: Number, default: 4.0 },
      vibrationCritical: { type: Number, default: 6.5 },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Machine", machineSchema);
