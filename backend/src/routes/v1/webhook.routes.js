const express = require('express');
const router = express.Router();
const webhookValidator = require('../../middleware/webhookValidator');
const { handleWebhook } = require('../../controllers/webhook.controller');

router.post('/survey123', webhookValidator, handleWebhook);

module.exports = router;
