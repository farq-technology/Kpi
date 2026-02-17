const winston = require('winston');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'kpi-dashboard' },
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length > 1 ? ` ${JSON.stringify(meta)}` : '';
              return `${timestamp} [${level}] ${message}${metaStr}`;
            })
          ),
    }),
  ],
});

// Add file transports in production
if (isProduction) {
  const logsDir = path.join(__dirname, '../../logs');
  logger.add(new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 5 }));
  logger.add(new winston.transports.File({ filename: path.join(logsDir, 'combined.log'), maxsize: 5242880, maxFiles: 5 }));
}

module.exports = logger;
