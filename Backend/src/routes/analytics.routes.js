const express = require("express");
const Machine = require("../models/Machine");
const Alert = require("../models/Alert");
const Telemetry = require("../models/Telemetry");
const authJwt = require("../middlewares/authJwt");
const { analyzePrediction } = require("../services/prediction");

const router = express.Router();

// GET /api/analytics/overview
router.get("/overview", authJwt, async (req, res, next) => {
  try {
    const machines = await Machine.find().sort({ machineId: 1 });
    const openAlertsCount = await Alert.countDocuments({ status: "open" });

    const latestTelemetry = await Telemetry.aggregate([
      { $sort: { machineId: 1, timestamp: -1 } },
      {
        $group: {
          _id: "$machineId",
          latest: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$latest" } },
      { $sort: { machineId: 1 } },
    ]);

    const summary = {
      totalMachines: machines.length,
      normal: machines.filter((m) => m.currentStatus === "NORMAL").length,
      alert: machines.filter((m) => m.currentStatus === "ALERT").length,
      failureProbable: machines.filter(
        (m) => m.currentStatus === "FAILURE_PROBABLE",
      ).length,
      openAlerts: openAlertsCount,
    };

    return res.status(200).json({
      success: true,
      summary,
      machines,
      latestTelemetry,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/predict/:machineId
router.get("/predict/:machineId", authJwt, async (req, res, next) => {
  try {
    const { machineId } = req.params;

    const machine = await Machine.findOne({ machineId });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: "Machine not found",
      });
    }

    const telemetryHistory = await Telemetry.find({ machineId })
      .sort({ timestamp: -1 })
      .limit(30)
      .lean();

    const prediction = analyzePrediction(machine, telemetryHistory);

    return res.status(200).json({
      success: true,
      machineId,
      prediction,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
