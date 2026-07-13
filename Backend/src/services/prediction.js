const SAMPLE_INTERVAL_SECONDS = 10;
const PROJECTION_OFFSET_SAMPLES = 5;

const round = (value, digits = 2) => {
  return Number(Number(value).toFixed(digits));
};

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const linearRegression = (points) => {
  const n = points.length;

  if (n === 0) {
    return { slope: 0, intercept: 0 };
  }

  const sumX = points.reduce((acc, point) => acc + point.x, 0);
  const sumY = points.reduce((acc, point) => acc + point.y, 0);
  const sumXY = points.reduce((acc, point) => acc + point.x * point.y, 0);
  const sumXX = points.reduce((acc, point) => acc + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;

  if (denominator === 0) {
    return {
      slope: 0,
      intercept: sumY / n,
    };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

const predictFromModel = (model, x) => {
  return model.intercept + model.slope * x;
};

const calculateRisk = (predictedValue, warning, critical) => {
  if (predictedValue >= critical) return 100;

  if (predictedValue >= warning) {
    const ratio = (predictedValue - warning) / (critical - warning || 1);
    return round(60 + ratio * 40);
  }

  const ratio = predictedValue / (warning || 1);
  return round(clamp(ratio * 60, 0, 59));
};

const normalizeHistory = (telemetryHistory = []) => {
  return telemetryHistory
    .filter(
      (item) =>
        item &&
        item.timestamp &&
        typeof item.temperature === "number" &&
        typeof item.vibration === "number",
    )
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const derivePredictedStatus = (
  predictedTemperature,
  predictedVibration,
  thresholds,
) => {
  const {
    temperatureWarning = 60,
    temperatureCritical = 75,
    vibrationWarning = 4.0,
    vibrationCritical = 6.5,
  } = thresholds || {};

  if (
    predictedTemperature >= temperatureCritical ||
    predictedVibration >= vibrationCritical
  ) {
    return "FAILURE_PROBABLE";
  }

  if (
    predictedTemperature >= temperatureWarning ||
    predictedVibration >= vibrationWarning
  ) {
    return "ALERT";
  }

  return "NORMAL";
};

const estimateTimeToThreshold = (
  currentValue,
  threshold,
  slopePerSample,
  sampleIntervalSeconds = SAMPLE_INTERVAL_SECONDS,
) => {
  if (typeof currentValue !== "number" || typeof threshold !== "number") {
    return null;
  }

  if (currentValue >= threshold) {
    return 0;
  }

  if (typeof slopePerSample !== "number" || slopePerSample <= 0) {
    return null;
  }

  const samplesToThreshold = (threshold - currentValue) / slopePerSample;

  if (!Number.isFinite(samplesToThreshold) || samplesToThreshold < 0) {
    return null;
  }

  const minutes = (samplesToThreshold * sampleIntervalSeconds) / 60;
  return round(minutes, 2);
};

const getSoonestEvent = (events = []) => {
  const validEvents = events.filter(
    (event) => event && typeof event.minutes === "number",
  );

  if (!validEvents.length) {
    return { minutes: null, driver: null };
  }

  validEvents.sort((a, b) => a.minutes - b.minutes);
  return validEvents[0];
};

const buildTimeline = ({
  currentStatus,
  latestTemperature,
  latestVibration,
  temperatureSlope,
  vibrationSlope,
  thresholds,
}) => {
  const {
    temperatureWarning = 60,
    temperatureCritical = 75,
    vibrationWarning = 4.0,
    vibrationCritical = 6.5,
  } = thresholds || {};

  const tempAlert = estimateTimeToThreshold(
    latestTemperature,
    temperatureWarning,
    temperatureSlope,
  );
  const vibAlert = estimateTimeToThreshold(
    latestVibration,
    vibrationWarning,
    vibrationSlope,
  );

  const tempCritical = estimateTimeToThreshold(
    latestTemperature,
    temperatureCritical,
    temperatureSlope,
  );
  const vibCritical = estimateTimeToThreshold(
    latestVibration,
    vibrationCritical,
    vibrationSlope,
  );

  const soonestAlert = getSoonestEvent([
    { driver: "temperature", minutes: tempAlert },
    { driver: "vibration", minutes: vibAlert },
  ]);

  const soonestEscalation = getSoonestEvent([
    { driver: "temperature", minutes: tempCritical },
    { driver: "vibration", minutes: vibCritical },
  ]);

  let nextEvent = "NONE";

  if (currentStatus === "NORMAL") {
    if (soonestAlert.minutes !== null) {
      nextEvent = "ALERT";
    } else if (soonestEscalation.minutes !== null) {
      nextEvent = "ESCALATION";
    }
  } else if (currentStatus === "ALERT") {
    if (soonestEscalation.minutes !== null) {
      nextEvent = "ESCALATION";
    }
  }

  return {
    nextEvent,
    timeToAlertMinutes: soonestAlert.minutes,
    timeToEscalationMinutes: soonestEscalation.minutes,
    alertDriver: soonestAlert.driver,
    escalationDriver: soonestEscalation.driver,
  };
};

const analyzePrediction = (machine, telemetryHistory = []) => {
  if (!machine) {
    throw new Error("Machine is required for prediction analysis");
  }

  const history = normalizeHistory(telemetryHistory);

  if (history.length < 5) {
    return {
      enoughData: false,
      sampleSize: history.length,
      message: "Not enough telemetry history for prediction",
      predictedTemperature: null,
      predictedVibration: null,
      riskScore: 0,
      predictedStatus: machine.currentStatus || "NORMAL",
      nextEvent: "NONE",
      timeToAlertMinutes: null,
      timeToEscalationMinutes: null,
      alertDriver: null,
      escalationDriver: null,
      trend: {
        temperatureSlope: 0,
        vibrationSlope: 0,
      },
    };
  }

  const temperaturePoints = history.map((item, index) => ({
    x: index,
    y: item.temperature,
  }));

  const vibrationPoints = history.map((item, index) => ({
    x: index,
    y: item.vibration,
  }));

  const temperatureModel = linearRegression(temperaturePoints);
  const vibrationModel = linearRegression(vibrationPoints);

  const nextIndex = history.length + PROJECTION_OFFSET_SAMPLES;

  const predictedTemperature = round(
    predictFromModel(temperatureModel, nextIndex),
  );
  const predictedVibration = round(predictFromModel(vibrationModel, nextIndex));

  const thresholds = machine.thresholds || {};
  const latest = history[history.length - 1];

  const temperatureRisk = calculateRisk(
    predictedTemperature,
    thresholds.temperatureWarning ?? 60,
    thresholds.temperatureCritical ?? 75,
  );

  const vibrationRisk = calculateRisk(
    predictedVibration,
    thresholds.vibrationWarning ?? 4.0,
    thresholds.vibrationCritical ?? 6.5,
  );

  const riskScore = round(Math.max(temperatureRisk, vibrationRisk));

  const predictedStatus = derivePredictedStatus(
    predictedTemperature,
    predictedVibration,
    thresholds,
  );

  const timeline = buildTimeline({
    currentStatus: machine.currentStatus || "NORMAL",
    latestTemperature: latest.temperature,
    latestVibration: latest.vibration,
    temperatureSlope: temperatureModel.slope,
    vibrationSlope: vibrationModel.slope,
    thresholds,
  });

  return {
    enoughData: true,
    sampleSize: history.length,
    latestTelemetry: {
      temperature: round(latest.temperature),
      vibration: round(latest.vibration),
      timestamp: latest.timestamp,
    },
    predictedTemperature,
    predictedVibration,
    predictedStatus,
    riskScore,
    nextEvent: timeline.nextEvent,
    timeToAlertMinutes: timeline.timeToAlertMinutes,
    timeToEscalationMinutes: timeline.timeToEscalationMinutes,
    alertDriver: timeline.alertDriver,
    escalationDriver: timeline.escalationDriver,
    trend: {
      temperatureSlope: round(temperatureModel.slope, 4),
      vibrationSlope: round(vibrationModel.slope, 4),
    },
  };
};

module.exports = {
  analyzePrediction,
};
