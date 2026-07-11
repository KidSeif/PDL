const express = require("express");
const Alert = require("../models/Alert");
const authJwt = require("../middlewares/authJwt");

const router = express.Router();

// GET /api/alerts
router.get("/", authJwt, async (req, res, next) => {
  try {
    const alerts = await Alert.find().sort({ triggeredAt: -1 });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/alerts/open
router.get("/open", authJwt, async (req, res, next) => {
  try {
    const alerts = await Alert.find({ status: "open" }).sort({
      triggeredAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/alerts/:id/resolve
router.patch("/:id/resolve", authJwt, async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found.",
      });
    }

    if (alert.status === "resolved") {
      return res.status(200).json({
        success: true,
        message: "Alert already resolved.",
        alert,
      });
    }

    alert.status = "resolved";
    alert.resolvedAt = new Date();
    await alert.save();

    return res.status(200).json({
      success: true,
      message: "Alert resolved successfully.",
      alert,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
