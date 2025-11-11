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

  for (const client of clients) {
    if (!client.ws || client.ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    if (client.userId === targetUserId || client.role === 'admin') {
      safeSend(client.ws, payload);
    }
  }
}

module.exports = {
  registerClient,
  broadcastTransaction,
};


