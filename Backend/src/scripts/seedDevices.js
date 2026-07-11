const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Device = require("../models/Device");

dotenv.config();

const devices = [
  {
    deviceId: "ESP32_PUMP_A1",
    machineId: "PUMP_A1",
    apiKey: "PUMP_A1_KEY_2026",
    isActive: true,
  },
  {
    deviceId: "ESP32_MOTOR_B2",
    machineId: "MOTOR_B2",
    apiKey: "MOTOR_B2_KEY_2026",
    isActive: true,
  },
  {
    deviceId: "ESP32_COMP_C1",
    machineId: "COMP_C1",
    apiKey: "COMP_C1_KEY_2026",
    isActive: true,
  },
  {
    deviceId: "ESP32_FAN_D1",
    machineId: "FAN_D1",
    apiKey: "FAN_D1_KEY_2026",
    isActive: true,
  },
  {
    deviceId: "ESP32_COOL_E1",
    machineId: "COOL_E1",
    apiKey: "COOL_E1_KEY_2026",
    isActive: true,
  },
  {
    deviceId: "ESP32_GEN_F1",
    machineId: "GEN_F1",
    apiKey: "GEN_F1_KEY_2026",
    isActive: true,
  },
];

const seedDevices = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[INFO] Connected to MongoDB");

    await Device.deleteMany({
      deviceId: { $in: devices.map((d) => d.deviceId) },
    });

    await Device.insertMany(devices);

    console.log("[INFO] Devices seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("[ERROR] Failed to seed devices:", error.message);
    process.exit(1);
  }
};

seedDevices();
