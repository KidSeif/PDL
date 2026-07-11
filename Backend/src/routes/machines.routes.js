const express = require("express");
const Machine = require("../models/Machine");
const authJwt = require("../middlewares/authJwt");

const router = express.Router();

// GET /api/machines
router.get("/", authJwt, async (req, res, next) => {
  try {
    const machines = await Machine.find().sort({ machineId: 1 });

    return res.status(200).json({
      success: true,
      count: machines.length,
      machines,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/machines/:machineId
router.get("/:machineId", authJwt, async (req, res, next) => {
  try {
    const { machineId } = req.params;

    const machine = await Machine.findOne({ machineId });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: `Machine not found: ${machineId}`,
      });
    }

    return res.status(200).json({
      success: true,
      machine,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
