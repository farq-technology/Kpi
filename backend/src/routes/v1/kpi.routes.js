const express = require('express');
const router = express.Router();
const kpiController = require('../../controllers/kpi.controller');

router.get('/summary', kpiController.getSummary);
router.get('/daily', kpiController.getDaily);
router.get('/weekly', kpiController.getWeekly);
router.get('/categories', kpiController.getCategories);
router.get('/agents', kpiController.getAgentPerformance);
router.get('/statuses', kpiController.getStatusDistribution);
router.get('/missing-fields', kpiController.getMissingFields);
router.get('/live', kpiController.getLiveKpi);

module.exports = router;
