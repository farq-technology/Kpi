const express = require('express');
const router = express.Router();
const surveyController = require('../../controllers/survey.controller');
const validateSurveyUpdate = require('../../middleware/validateSurveyUpdate');

router.get('/', surveyController.listSurveys);
router.get('/filters', surveyController.getFilterOptions);
router.get('/geojson', surveyController.getGeoJSON);
router.get('/:id', surveyController.getSurveyById);
router.put('/:id', validateSurveyUpdate, surveyController.updateSurvey);
router.patch('/:id/review', surveyController.reviewSurvey);
router.post('/batch-review', surveyController.batchReview);

module.exports = router;
