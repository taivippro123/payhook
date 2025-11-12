# Payhook Webhook Integration Guide

This document explains how to configure Payhook to forward detected bank transactions to your own system via webhook.

---

## 1. Overview

When Payhook parses an incoming bank email and creates a transaction, it can immediately `POST` a JSON payload to a webhook URL that you provide. Typical use cases:

- Mark an order as paid in a POS / e-commerce backend  
- Trigger internal automations (notifications, fulfilment, etc.)

Retries are built in: Payhook will attempt delivery up to **3 times** (with exponential backoff) whenever the webhook returns a non-2xx response or times out.

---

## 2. Enable Webhook Delivery

1. Log in as an admin to the Payhook dashboard.  
2. Open the **Email Config** you want to monitor (or create a new one).  
3. Provide the following fields:
   - `email`: Gmail address that receives banking alerts
   - `appPassword`: Gmail App Password
   - `webhookUrl`: HTTPS URL to your webhook endpoint (e.g. `https://example.com/webhook/payhook`)
4. Save the config. Transactions detected from that mailbox will now trigger webhook calls.

> **Tip:** If you manage configs via API, include the `webhookUrl` attribute in both `POST /api/email-configs` and `PUT /api/email-configs/:id`.

---

## 3. Request Details

| Attribute          | Value                              |
|--------------------|------------------------------------|
| Method             | `POST`                             |
| Headers            | `Content-Type: application/json`<br>`User-Agent: Payhook/1.0` |
| Timeout            | 10 seconds                         |
| Retry Strategy     | Up to 3 attempts (1s → 2s → 4s) for network errors or non-2xx responses |

### Payload Structure

```json
{
  "event": "transaction.detected",
  "timestamp": "2025-11-12T12:34:56.789Z",
  "transaction": {
    "_id": "6743b5e7f1d3cfa1e3b12345",
    "userId": "6720e9cbe2a7496d4b123456",
    "emailConfigId": "6720ea3de2a7496d4b654321",
    "transactionId": "FT123456789",
    "bank": "CAKE",
    "amountVND": 1500000,
    "description": "ND CK 1500000 VND",
    "emailUid": 1234,
    "emailDate": "2025-11-12T12:33:45.000Z",
    "detectedAt": "2025-11-12T12:34:56.789Z",
    "createdAt": "2025-11-12T12:34:56.789Z",
    "...": "other bank-specific parser fields"
  }
}
```

- Fields mirror what Payhook stores in MongoDB (excluding the raw email body).  
- Additional parser-specific keys (e.g. account numbers) may be present depending on the bank parser.

---

## 4. Expected Responses

Respond with a `2xx` status code (e.g. `200 OK`) after you successfully process the payload:

```json
{
  "success": true
}
```

If you return a `4xx` (client error) response, Payhook **will not** retry (assumes the payload is invalid).  
If you return a `5xx` or the request times out, Payhook retries automatically.

---

## 5. Example Receiver (Node.js / Express)

```js
app.post('/webhook/payhook', async (req, res) => {
  const { event, transaction } = req.body;

  if (event !== 'transaction.detected' || !transaction?.transactionId) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Perform your business logic (e.g. mark order as paid)
  await markOrderPaid(transaction.transactionId, transaction.amountVND);

  return res.json({ success: true });
});
```

---

## 6. Troubleshooting

| Symptom | Checklist |
|---------|-----------|
| No webhook requests | Ensure `webhookUrl` is set and HTTPS is reachable. Check Payhook server logs for warnings. |
| Duplicate processing | Handle idempotency on your side (e.g. ignore `transactionId` that was processed already). |
| Timeouts | Make sure your endpoint responds within 10 seconds. Offload heavy work to background jobs if needed. |
| Missing fields | Inspect incoming payload to confirm parser support for your bank. Custom parsers can add more fields if required. |

---

## 7. Security Recommendations

- Prefer HTTPS endpoints.  
- Validate `transaction.transactionId` and amount before applying business changes.  
- Implement request authentication if desired (e.g. restrict by IP, include shared secret header via reverse proxy).

---

Need more help? Reach the Payhook team or check the source in `services/webhookSender.js` & `services/multiUserEmailMonitor.js` for exact implementation details.

