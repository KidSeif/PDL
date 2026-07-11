const Device = require("../models/Device");

const authDevice = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "Device API key is required.",
      });
    }

    const device = await Device.findOne({
      apiKey,
      isActive: true,
    });

    if (!device) {
      return res.status(401).json({
        success: false,
        message: "Invalid or inactive device API key.",
      });
    }

    req.device = device;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authDevice;
