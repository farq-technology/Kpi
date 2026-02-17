const express = require('express');
const router = express.Router();
const surveyController = require('../../controllers/survey.controller');

router.get('/', surveyController.listSurveys);
router.get('/filters', surveyController.getFilterOptions);
router.get('/geojson', surveyController.getGeoJSON);
router.get('/:id', surveyController.getSurveyById);
router.put('/:id', surveyController.updateSurvey);

module.exports = router;
