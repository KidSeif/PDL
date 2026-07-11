const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["ANOMALY", "DRIFT", "FAILURE_PROBABLE"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["warning", "critical"],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Alert", alertSchema);
