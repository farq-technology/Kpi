const app = require('./app');
const config = require('./config/env');
const pool = require('./db/pool');

const PORT = config.port;

async function start() {
  // Test database connection
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
  } catch (err) {
    console.warn('Database not available - running in ArcGIS-only mode:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`\n  KPI Dashboard Backend running on port ${PORT}`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Health: http://localhost:${PORT}/api/health`);
    console.log(`  SSE: http://localhost:${PORT}/api/v1/events`);
    console.log(`  Webhook: POST http://localhost:${PORT}/api/v1/webhook/survey123`);
    console.log(`  KPIs: http://localhost:${PORT}/api/v1/kpi/summary`);
    console.log(`  Live KPIs: http://localhost:${PORT}/api/v1/kpi/live`);
    console.log('');
  });
}

start();
