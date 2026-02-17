const express = require('express');
const router = express.Router();
const mediaController = require('../../controllers/media.controller');

router.get('/', mediaController.listMedia);
router.get('/arcgis-attachments', mediaController.fetchAttachmentsFromArcGIS);
router.post('/sync-attachments', mediaController.syncAllAttachments);
router.get('/:id/download', mediaController.downloadMedia);

module.exports = router;
