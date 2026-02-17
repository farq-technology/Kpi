const app = require('./app');
const config = require('./config/env');
const pool = require('./db/pool');
const syncRetry = require('./services/sync-retry.service');
const logger = require('./utils/logger');

const PORT = config.port;

async function start() {
  // Test database connection
  try {
    const client = await pool.connect();
    logger.info('Database connected successfully');
    client.release();
  } catch (err) {
    logger.warn('Database not available - running in ArcGIS-only mode', { error: err.message });
  }

  // Start sync retry scheduler
  syncRetry.start();

  app.listen(PORT, () => {
    logger.info(`KPI Dashboard Backend running on port ${PORT}`, {
      environment: config.nodeEnv,
      health: `http://localhost:${PORT}/api/health`,
      webhook: `http://localhost:${PORT}/api/v1/webhook/survey123`,
    });
  });
}

start();
