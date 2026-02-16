const express = require('express');
const router = express.Router();

const webhookRoutes = require('./webhook.routes');
const kpiRoutes = require('./kpi.routes');
const surveysRoutes = require('./surveys.routes');
const mediaRoutes = require('./media.routes');

router.use('/webhook', webhookRoutes);
router.use('/kpi', kpiRoutes);
router.use('/surveys', surveysRoutes);
router.use('/media', mediaRoutes);

module.exports = router;
