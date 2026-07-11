const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    machineId: {
      type: String, 
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "warning",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved", "escalated"],
      default: "open",
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
    },
    escalatedAt: {
      type: Date,
    },
    escalatedTo: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Alert", alertSchema);
