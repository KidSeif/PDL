const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Machine = require("../models/Machine");

dotenv.config();

const machines = [
  {
    machineId: "PUMP_A1",
    name: "Water Circulation Pump",
    type: "Pump",
    location: "Factory Floor A",
    currentStatus: "NORMAL",
    thresholds: {
      temperatureWarning: 60,
      temperatureCritical: 75,
      vibrationWarning: 4.0,
      vibrationCritical: 6.5,
    },
  },
  {
    machineId: "MOTOR_B2",
    name: "Conveyor Motor",
    type: "Motor",
    location: "Factory Floor B",
    currentStatus: "NORMAL",
    thresholds: {
      temperatureWarning: 62,
      temperatureCritical: 78,
      vibrationWarning: 4.2,
      vibrationCritical: 6.8,
    },
  },
  {
    machineId: "COMP_C1",
    name: "Air Compressor",
    type: "Compressor",
    location: "Utility Room",
    currentStatus: "NORMAL",
    thresholds: {
      temperatureWarning: 65,
      temperatureCritical: 80,
      vibrationWarning: 4.5,
      vibrationCritical: 7.0,
    },
  },
  {
    machineId: "FAN_D1",
    name: "Industrial Ventilation Fan",
    type: "Fan",
    location: "Ventilation Zone",
    currentStatus: "NORMAL",
    thresholds: {
      temperatureWarning: 58,
      temperatureCritical: 72,
      vibrationWarning: 3.8,
      vibrationCritical: 6.2,
    },
  },
  {
    machineId: "COOL_E1",
    name: "Cooling Unit",
    type: "Cooling",
    location: "Cooling Zone",
    currentStatus: "NORMAL",
    thresholds: {
      temperatureWarning: 55,
      temperatureCritical: 70,
      vibrationWarning: 3.5,
      vibrationCritical: 6.0,
    },
  },
  {
    machineId: "GEN_F1",
    name: "Auxiliary Generator",
    type: "Generator",
    location: "Power Backup Room",
    currentStatus: "NORMAL",
    thresholds: {
      temperatureWarning: 68,
      temperatureCritical: 85,
      vibrationWarning: 4.8,
      vibrationCritical: 7.2,
    },
  },
];

const seedMachines = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[INFO] Connected to MongoDB");

    await Machine.deleteMany({
      machineId: {
        $in: machines.map((m) => m.machineId),
      },
    });

    await Machine.insertMany(machines);

    console.log("[INFO] Machines seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("[ERROR] Failed to seed machines:", error.message);
    process.exit(1);
  }
};

seedMachines();
