const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const User = require("../models/User");

dotenv.config();

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("[INFO] Connected to MongoDB");

    await User.deleteMany({
      username: { $in: ["admin", "operator"] },
    });

    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    const operatorPasswordHash = await bcrypt.hash("operator123", 10);

    await User.create([
      {
        username: "admin",
        passwordHash: adminPasswordHash,
        role: "admin",
      },
      {
        username: "operator",
        passwordHash: operatorPasswordHash,
        role: "operator",
      },
    ]);

    console.log("[INFO] Users seeded successfully");
    console.log("[INFO] admin / admin123");
    console.log("[INFO] operator / operator123");

    process.exit(0);
  } catch (error) {
    console.error("[ERROR] Failed to seed users:", error.message);
    process.exit(1);
  }
};

seedUsers();
