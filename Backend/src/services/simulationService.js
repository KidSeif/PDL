const axios = require("axios");

const MACHINE_PROFILES = [
  {
    machineId: "MOTOR_B2",
    apiKey: process.env.MOTOR_B2_API_KEY || "MOTOR_B2_KEY_2026",
    baseTemperature: 45,
    baseHumidity: 58,
    baseLuminosity: 420,
    baseDistance: 18,
    baseVibration: 2.5,
    temperatureVariance: 8,
    vibrationVariance: 2.0,
    pattern: "steady",
  },
  {
    machineId: "COMP_C1",
    apiKey: process.env.COMP_C1_API_KEY || "COMP_C1_KEY_2026",
    baseTemperature: 55,
    baseHumidity: 52,
    baseLuminosity: 460,
    baseDistance: 16,
    baseVibration: 3.0,
    temperatureVariance: 12,
    vibrationVariance: 2.5,
    pattern: "heating_up",
  },
  {
    machineId: "FAN_D1",
    apiKey: process.env.FAN_D1_API_KEY || "FAN_D1_KEY_2026",
    baseTemperature: 35,
    baseHumidity: 60,
    baseLuminosity: 390,
    baseDistance: 22,
    baseVibration: 1.5,
    temperatureVariance: 5,
    vibrationVariance: 1.0,
    pattern: "stable",
  },
  {
    machineId: "COOL_E1",
    apiKey: process.env.COOL_E1_API_KEY || "COOL_E1_KEY_2026",
    baseTemperature: 25,
    baseHumidity: 65,
    baseLuminosity: 350,
    baseDistance: 20,
    baseVibration: 1.0,
    temperatureVariance: 10,
    vibrationVariance: 0.8,
    pattern: "cyclic",
  },
  {
    machineId: "GEN_F1",
    apiKey: process.env.GEN_F1_API_KEY || "GEN_F1_KEY_2026",
    baseTemperature: 50,
    baseHumidity: 50,
    baseLuminosity: 480,
    baseDistance: 14,
    baseVibration: 2.0,
    temperatureVariance: 15,
    vibrationVariance: 1.5,
    pattern: "intermittent",
  },
];

const round = (value, digits = 2) => {
  return Number(Number(value).toFixed(digits));
};

const randomBetween = (min, max) => {
  return Math.random() * (max - min) + min;
};

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const getPatternFactor = (pattern, tick) => {
  switch (pattern) {
    case "heating_up":
      return Math.min(tick * 0.15, 6);
    case "cyclic":
      return Math.sin(tick / 3) * 6;
    case "intermittent":
      return tick % 10 < 3 ? 7 : -2;
    case "stable":
      return Math.sin(tick / 8) * 1.5;
    case "steady":
    default:
      return Math.sin(tick / 5) * 2;
  }
};

const generateTelemetry = (profile, tick) => {
  const factor = getPatternFactor(profile.pattern, tick);

  const temperature = clamp(
    profile.baseTemperature +
      factor +
      randomBetween(-profile.temperatureVariance, profile.temperatureVariance),
    15,
    95,
  );

  const vibration = clamp(
    profile.baseVibration +
      factor * 0.08 +
      randomBetween(-profile.vibrationVariance, profile.vibrationVariance),
    0.2,
    10,
  );

  const humidity = clamp(profile.baseHumidity + randomBetween(-8, 8), 20, 95);

  const luminosity = clamp(
    profile.baseLuminosity + randomBetween(-80, 80),
    100,
    900,
  );

  const distance = clamp(profile.baseDistance + randomBetween(-6, 6), 2, 80);

  const presence = Math.random() > 0.35;

  return {
    temperature: round(temperature),
    humidity: round(humidity),
    luminosity: round(luminosity),
    distance: round(distance),
    presence,
    vibration: round(vibration),
    timestamp: new Date().toISOString(),
  };
};

const sendTelemetry = async (baseUrl, profile, tick) => {
  const payload = generateTelemetry(profile, tick);

  try {
    const response = await axios.post(`${baseUrl}/api/telemetry`, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": profile.apiKey,
      },
      timeout: 10000,
    });

    console.log(
      `[Simulation] ${profile.machineId} -> ${response.status} | temp=${payload.temperature}°C vib=${payload.vibration}`,
    );
  } catch (error) {
    const status = error.response?.status || "NO_RESPONSE";
    const message = error.response?.data?.message || error.message;

    console.error(
      `[Simulation] ${profile.machineId} failed -> ${status} | ${message}`,
    );
  }
};

const startSimulationService = () => {
  const enabled = process.env.ENABLE_SIMULATION === "true";

  if (!enabled) {
    console.log("[Simulation] disabled");
    return null;
  }

  const baseUrl =
    process.env.SIMULATION_TARGET_URL ||
    `http://localhost:${process.env.PORT || 5000}`;

  console.log(`[Simulation] started -> target: ${baseUrl}`);

  let tick = 0;

  const interval = setInterval(async () => {
    tick += 1;

    await Promise.all(
      MACHINE_PROFILES.map((profile) => sendTelemetry(baseUrl, profile, tick)),
    );
  }, 10000);

  return interval;
};

module.exports = {
  startSimulationService,
};
