const WebSocket = require('ws');

const clients = new Set();

function safeSend(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    console.error('WS send error:', error.message);
  }
}

function registerClient(ws, meta) {
  const client = {
    ws,
    userId: meta.userId,
    username: meta.username,
    role: meta.role || 'user',
    connectedAt: Date.now(),
  };

  clients.add(client);

  ws.on('close', () => {
    clients.delete(client);
  });

  ws.on('error', () => {
    clients.delete(client);
  });

  safeSend(ws, {
    event: 'ws.connected',
    data: {
      userId: client.userId,
      role: client.role,
      connectedAt: client.connectedAt,
    },
  });
}

function broadcastTransaction(transaction, targetUserId) {
  const payload = {
    event: 'transaction:new',
    data: transaction,
  };

  // Normalize userId để so sánh (convert sang string)
  const targetUserIdStr = targetUserId?.toString();

  console.log(`📡 Broadcasting transaction to userId: ${targetUserIdStr}, clients: ${clients.size}`);

  for (const client of clients) {
    if (!client.ws || client.ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    const clientUserIdStr = client.userId?.toString();
    const shouldSend = client.role === 'admin' || clientUserIdStr === targetUserIdStr;

    if (shouldSend) {
      console.log(`✅ Sending transaction to client: userId=${clientUserIdStr}, role=${client.role}`);
      safeSend(client.ws, payload);
    }
  }
}

function broadcastWebhookLog(webhookLog, targetUserId) {
  const payload = {
    event: 'webhook:new',
    data: webhookLog,
  };

  // Normalize userId để so sánh
  const targetUserIdStr = targetUserId?.toString();

  console.log(`📡 Broadcasting webhook log to userId: ${targetUserIdStr}, clients: ${clients.size}`);

  for (const client of clients) {
    if (!client.ws || client.ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    const clientUserIdStr = client.userId?.toString();
    // Admin có thể xem tất cả, user chỉ xem của mình
    const shouldSend = client.role === 'admin' || clientUserIdStr === targetUserIdStr;

    if (shouldSend) {
      console.log(`✅ Sending webhook log to client: userId=${clientUserIdStr}, role=${client.role}`);
      safeSend(client.ws, payload);
    }
  }
}

function broadcastWebhookLogUpdate(webhookLog, targetUserId) {
  const payload = {
    event: 'webhook:update',
    data: webhookLog,
  };

  // Normalize userId để so sánh
  const targetUserIdStr = targetUserId?.toString();

  for (const client of clients) {
    if (!client.ws || client.ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    const clientUserIdStr = client.userId?.toString();
    // Admin có thể xem tất cả, user chỉ xem của mình
    const shouldSend = client.role === 'admin' || clientUserIdStr === targetUserIdStr;

    if (shouldSend) {
      safeSend(client.ws, payload);
    }
  }
}

module.exports = {
  registerClient,
  broadcastTransaction,
  broadcastWebhookLog,
  broadcastWebhookLogUpdate,
};


