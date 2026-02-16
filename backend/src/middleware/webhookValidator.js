const crypto = require('crypto');
const config = require('../config/env');

function webhookValidator(req, res, next) {
  // Check secret query parameter
  const secret = req.query.secret;
  if (config.webhookSecret && secret !== config.webhookSecret) {
    console.warn('Webhook rejected: invalid secret from', req.ip);
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  // Verify HMAC signature if present (ArcGIS Feature Service webhooks)
  const signature = req.headers['x-esri-signature'];
  if (signature && config.webhookSecret) {
    const expected = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  next();
}

module.exports = webhookValidator;
