const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Start HTTP Listener
    const server = app.listen(env.PORT, () => {
      logger.info(`ResCrafted 2.0 Backend running in [${env.NODE_ENV}] mode on http://localhost:${env.PORT}`);
    });

    // 3. Graceful Shutdown Handlers
    const handleShutdown = (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });

      // Force exit if not closed within 10s
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    // Handle Unhandled Promise Rejections & Uncaught Exceptions
    process.on('unhandledRejection', (err) => {
      logger.error({ err }, 'Unhandled Promise Rejection detected:');
    });

    process.on('uncaughtException', (err) => {
      logger.error({ err }, 'Uncaught Exception detected! Exiting process...');
      process.exit(1);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
