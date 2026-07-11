const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const machinesRoutes = require("./routes/machines.routes");
const telemetryRoutes = require("./routes/telemetry.routes");
const alertsRoutes = require("./routes/alerts.routes");

const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Predictive Maintenance Backend API",
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/machines", machinesRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/alerts", alertsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
