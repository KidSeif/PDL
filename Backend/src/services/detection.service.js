const Telemetry = require("../models/Telemetry");
const Alert = require("../models/Alert");

const getRecentTelemetry = async (machineId, limit = 5) => {
  return Telemetry.find({ machineId }).sort({ timestamp: -1 }).limit(limit);
};

const calculateAverage = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const detectStatus = async (machine, telemetryInput) => {
  const flags = [];
  const { temperature, vibration } = telemetryInput;
  const thresholds = machine.thresholds;

  const recent = await getRecentTelemetry(machine.machineId, 5);

  const recentTemps = recent.map((item) => item.temperature);
  const recentVibrations = recent.map((item) => item.vibration);

  const avgTemp = calculateAverage(recentTemps);
  const avgVibration = calculateAverage(recentVibrations);

  let derivedStatus = "NORMAL";
  let alertType = null;
  let severity = null;
  let alertTitle = null;
  let alertMessage = null;

  // Critical thresholds
  if (temperature >= thresholds.temperatureCritical) {
    flags.push("TEMPERATURE_CRITICAL");
  }

  if (vibration >= thresholds.vibrationCritical) {
    flags.push("VIBRATION_CRITICAL");
  }

  // Warning thresholds
  if (temperature >= thresholds.temperatureWarning) {
    flags.push("TEMPERATURE_WARNING");
  }

  if (vibration >= thresholds.vibrationWarning) {
    flags.push("VIBRATION_WARNING");
  }

  // Simple drift detection compared to recent average
  if (recent.length >= 3) {
    if (avgTemp > 0 && temperature >= avgTemp + 4) {
      flags.push("TEMPERATURE_DRIFT");
    }

    if (avgVibration > 0 && vibration >= avgVibration + 0.8) {
      flags.push("VIBRATION_DRIFT");
    }
  }

  // Final classification
  if (
    flags.includes("TEMPERATURE_CRITICAL") ||
    flags.includes("VIBRATION_CRITICAL") ||
    (flags.includes("TEMPERATURE_WARNING") &&
      flags.includes("VIBRATION_WARNING"))
  ) {
    derivedStatus = "FAILURE_PROBABLE";
    alertType = "FAILURE_PROBABLE";
    severity = "critical";
    alertTitle = "Failure probable detected";
    alertMessage =
      "Critical machine behavior detected based on temperature/vibration thresholds.";
  } else if (
    flags.includes("TEMPERATURE_WARNING") ||
    flags.includes("VIBRATION_WARNING") ||
    flags.includes("TEMPERATURE_DRIFT") ||
    flags.includes("VIBRATION_DRIFT")
  ) {
    derivedStatus = "ALERT";

    if (
      flags.includes("TEMPERATURE_DRIFT") ||
      flags.includes("VIBRATION_DRIFT")
    ) {
      alertType = "DRIFT";
      alertTitle = "Drift detected";
      alertMessage =
        "Progressive drift detected compared to recent telemetry history.";
    } else {
      alertType = "ANOMALY";
      alertTitle = "Anomaly detected";
      alertMessage =
        "Warning threshold exceeded for one or more monitored metrics.";
    }

    severity = "warning";
  }

  return {
    derivedStatus,
    flags,
    alert:
      derivedStatus === "NORMAL"
        ? null
        : {
            type: alertType,
            severity,
            title: alertTitle,
            message: alertMessage,
          },
  };
};

const createAlert = async (machine, detectionResult) => {
  try {
    // 🔥 ANTI-DUPLICATE : vérifier si une alerte ouverte identique existe
    const existingOpen = await Alert.findOne({
      machineId: machine._id,
      type: detectionResult.type,
      status: "open",
    });

    if (existingOpen) {
      console.log(
        `[Alert] Duplicate prevented for ${machine.machineId} - ${detectionResult.type} already open`,
      );
      return null;
    }

    // Si une alerte d'un AUTRE type est ouverte pour cette machine, la résoudre
    const otherOpen = await Alert.findOne({
      machineId: machine._id,
      status: "open",
      type: { $ne: detectionResult.type },
    });

    if (otherOpen) {
      otherOpen.status = "resolved";
      otherOpen.resolvedAt = new Date();
      await otherOpen.save();
      console.log(
        `[Alert] Auto-resolved older ${otherOpen.type} for ${machine.machineId}`,
      );
    }

    const alert = new Alert({
      machineId: machine._id,
      type: detectionResult.type,
      severity: detectionResult.severity,
      title: detectionResult.title,
      message: detectionResult.message,
      status: "open",
      triggeredAt: new Date(),
    });

    await alert.save();
    console.log(
      `[Alert] Created: ${detectionResult.type} for ${machine.machineId}`,
    );
    return alert;
  } catch (err) {
    console.error("[Alert] Failed to create alert:", err);
    return null;
  }
};

module.exports = {
  detectStatus,
};
