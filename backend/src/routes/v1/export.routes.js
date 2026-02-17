const express = require('express');
const router = express.Router();
const exportController = require('../../controllers/export.controller');

// NAVER Delivery Exports
router.get('/naver/json', exportController.exportNaverJson);
router.get('/naver/csv', exportController.exportNaverCsv);
router.get('/naver/kpi', exportController.getNaverKpiReport);
router.get('/naver/billing', exportController.getBillingSummary);
router.get('/naver/validation', exportController.getValidationReport);

module.exports = router;
