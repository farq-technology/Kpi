const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const realtimeService = require('./services/realtime.service');
const v1Routes = require('./routes/v1');

const app = express();

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: function (origin, callback) {
    const allowed = (config.frontendUrl || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sseClients: realtimeService.getClientCount(),
  });
});

// SSE endpoint (no rate limit)
app.get('/api/v1/events', (req, res) => {
  realtimeService.addClient(req, res);
});

// API routes
app.use('/api/v1', rateLimiter, v1Routes);

// Error handling
app.use(errorHandler);

module.exports = app;
