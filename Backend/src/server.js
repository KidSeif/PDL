const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const logger = require("./utils/logger");

const startServer = async () => {
  await connectDB();

  app.listen(env.port, () => {
    logger.info(`Server running on http://localhost:${env.port}`);
  });
};

startServer();
