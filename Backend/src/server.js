const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const { startSimulationService } = require("./services/simulationService");

const PORT = env.port || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startSimulationService();
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
