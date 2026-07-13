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

  const nextIndex = history.length + 5;

  const predictedTemperature = round(
    predictFromModel(temperatureModel, nextIndex),
  );
  const predictedVibration = round(predictFromModel(vibrationModel, nextIndex));

  const thresholds = machine.thresholds || {};

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

  return {
    enoughData: true,
    sampleSize: history.length,
    latestTelemetry: {
      temperature: round(history[history.length - 1].temperature),
      vibration: round(history[history.length - 1].vibration),
      timestamp: history[history.length - 1].timestamp,
    },
    predictedTemperature,
    predictedVibration,
    predictedStatus,
    riskScore,
    trend: {
      temperatureSlope: round(temperatureModel.slope, 4),
      vibrationSlope: round(vibrationModel.slope, 4),
    },
  };
};

module.exports = {
  analyzePrediction,
};
