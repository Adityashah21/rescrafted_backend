const mongoose = require('mongoose');
const { sendSuccess } = require('../utils/apiResponse');

const getHealthStatus = (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = dbStateMap[mongoose.connection.readyState] || 'unknown';

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbState,
      name: mongoose.connection.name || 'default'
    },
    version: '2.0.0'
  };

  return sendSuccess(res, 200, 'ResCrafted API is operating normally', healthData);
};

module.exports = {
  getHealthStatus
};
