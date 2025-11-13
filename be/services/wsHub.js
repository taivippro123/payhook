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

  let sentCount = 0;
  for (const client of clients) {
    if (!client.ws || client.ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    const clientUserIdStr = client.userId?.toString();
    const shouldSend = client.role === 'admin' || clientUserIdStr === targetUserIdStr;

    if (shouldSend) {
      safeSend(client.ws, payload);
      sentCount++;
    }
  }
  
  // Chỉ log khi có gửi thành công
  if (sentCount > 0) {
    console.log(`📡 Broadcast transaction to ${sentCount} client(s) for userId: ${targetUserIdStr}`);
  }
}

function broadcastWebhookLog(webhookLog, targetUserId) {
  const payload = {
    event: 'webhook:new',
    data: webhookLog,
  };

  // Normalize userId để so sánh
  const targetUserIdStr = targetUserId?.toString();

  let sentCount = 0;
  for (const client of clients) {
    if (!client.ws || client.ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    const clientUserIdStr = client.userId?.toString();
    // Admin có thể xem tất cả, user chỉ xem của mình
    const shouldSend = client.role === 'admin' || clientUserIdStr === targetUserIdStr;

    if (shouldSend) {
      safeSend(client.ws, payload);
      sentCount++;
    }
  }
  
  // Chỉ log khi có gửi thành công (giảm noise)
  if (sentCount > 0) {
    console.log(`📡 Broadcast webhook log to ${sentCount} client(s) for userId: ${targetUserIdStr}`);
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


