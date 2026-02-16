class RealtimeService {
  constructor() {
    this.clients = new Set();
  }

  addClient(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to KPI stream' })}\n\n`);

    this.clients.add(res);
    console.log(`SSE client connected. Total clients: ${this.clients.size}`);

    req.on('close', () => {
      this.clients.delete(res);
      console.log(`SSE client disconnected. Total clients: ${this.clients.size}`);
    });
  }

  broadcast(eventType, data) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.write(message);
    }
  }

  getClientCount() {
    return this.clients.size;
  }
}

module.exports = new RealtimeService();
