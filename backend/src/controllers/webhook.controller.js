const webhookService = require('../services/webhook.service');
const kpiService = require('../services/kpi.service');
const realtimeService = require('../services/realtime.service');

async function handleWebhook(req, res) {
  try {
    const payload = req.body;
    console.log(`Webhook received: ${payload.eventType || 'unknown'}`);

    const result = await webhookService.processWebhook(payload);

    // Recalculate and broadcast KPIs
    const kpiSummary = await kpiService.getSummary();
    realtimeService.broadcast('kpi:updated', kpiSummary);
    realtimeService.broadcast('survey:new', {
      id: result.id,
      objectId: result.objectId,
      globalId: result.globalId,
      complianceScore: result.complianceScore,
    });

    console.log(`Webhook processed: objectId=${result.objectId}, compliance=${result.complianceScore}%`);
    res.json({ status: 'ok', id: result.id });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}

module.exports = { handleWebhook };
