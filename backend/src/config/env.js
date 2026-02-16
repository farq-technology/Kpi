require('dotenv').config();

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  arcgis: {
    username: process.env.ARCGIS_USERNAME,
    password: process.env.ARCGIS_PASSWORD,
    serviceUrl: process.env.ARCGIS_SERVICE_URL,
    tokenUrl: 'https://www.arcgis.com/sharing/rest/generateToken',
    portalUrl: 'https://www.arcgis.com',
  },
};

module.exports = config;
