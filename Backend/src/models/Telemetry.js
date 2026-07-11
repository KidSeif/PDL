const mongoose = require("mongoose");

const telemetrySchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    temperature: {
      type: Number,
      required: true,
    },
    humidity: {
      type: Number,
      required: true,
    },
    luminosity: {
      type: Number,
      required: true,
    },
    distance: {
      type: Number,
      required: true,
    },
    presence: {
      type: Boolean,
      required: true,
    },
    vibration: {
      type: Number,
      required: true,
    },
    derivedStatus: {
      type: String,
      enum: ["NORMAL", "ALERT", "FAILURE_PROBABLE"],
      default: "NORMAL",
    },
    anomalyFlags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

telemetrySchema.index({ machineId: 1, timestamp: -1 });

module.exports = mongoose.model("Telemetry", telemetrySchema);
