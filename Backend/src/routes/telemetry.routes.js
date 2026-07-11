const express = require("express");

const Telemetry = require("../models/Telemetry");
const Machine = require("../models/Machine");
const Alert = require("../models/Alert");
const authJwt = require("../middlewares/authJwt");
const { detectStatus } = require("../services/detection.service");
const authDevice = require("../middlewares/authDevice");

const router = express.Router();

// POST /api/telemetry
router.post("/", authDevice, async (req, res, next) => {
  try {
    const {
      machineId: bodyMachineId,
      temperature,
      humidity,
      luminosity,
      distance,
      presence,
      vibration,
      timestamp,
    } = req.body;

    const machineId = req.device.machineId;

    if (bodyMachineId && bodyMachineId !== machineId) {
      return res.status(403).json({
        success: false,
        message: "Device is not allowed to send telemetry for this machine.",
      });
    }

    if (
      temperature === undefined ||
      humidity === undefined ||
      luminosity === undefined ||
      distance === undefined ||
      presence === undefined ||
      vibration === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required telemetry fields.",
      });
    }

    const machine = await Machine.findOne({ machineId });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: `Machine not found: ${machineId}`,
      });
    }

    const detectionResult = await detectStatus(machine, {
      temperature,
      vibration,
    });

    const telemetry = await Telemetry.create({
      machineId,
      timestamp: timestamp || new Date(),
      temperature,
      humidity,
      luminosity,
      distance,
      presence,
      vibration,
      derivedStatus: detectionResult.derivedStatus,
      anomalyFlags: detectionResult.flags,
    });

    machine.currentStatus = detectionResult.derivedStatus;
    await machine.save();

    if (detectionResult.alert) {
      // ANTI-DUPLICATE : même type déjà ouvert ?
      const existingOpenAlert = await Alert.findOne({
        machineId,
        type: detectionResult.alert.type,
        status: "open",
      }); 
      

      if (!existingOpenAlert) {
        //  AUTO-RESOLVE : si une alerte d'un AUTRE type est ouverte, la fermer
        const otherOpenAlert = await Alert.findOne({
          machineId,
          status: "open",
          type: { $ne: detectionResult.alert.type },
        });

        if (otherOpenAlert) {
          otherOpenAlert.status = "escalated";
          otherOpenAlert.escalatedAt = new Date();
          otherOpenAlert.escalatedTo = detectionResult.alert.type;
          await otherOpenAlert.save();
          console.log(
            `[Alert] ESCALATED ${otherOpenAlert.type} → ${detectionResult.alert.type} for ${machineId}`,
          );
        }

        await Alert.create({
          machineId,
          type: detectionResult.alert.type,
          severity: detectionResult.alert.severity,
          title: detectionResult.alert.title,
          message: detectionResult.alert.message,
          status: "open",
          triggeredAt: new Date(),
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Telemetry saved successfully.",
      telemetry,
      device: {
        deviceId: req.device.deviceId,
        machineId: req.device.machineId,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/telemetry/latest
router.get("/latest", authJwt, async (req, res, next) => {
  try {
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

    return res.status(200).json({
      success: true,
      count: latestTelemetry.length,
      telemetry: latestTelemetry,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/telemetry/history/:machineId
router.get("/history/:machineId", authJwt, async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const limit = Number(req.query.limit) || 50;

    const telemetryHistory = await Telemetry.find({ machineId })
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: telemetryHistory.length,
      telemetry: telemetryHistory,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
