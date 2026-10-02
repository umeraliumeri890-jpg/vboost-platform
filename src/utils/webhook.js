// src/utils/webhook.js
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../config/logger');

/**
 * Sign a payload with HMAC-SHA256.
 * Signature format: "sha256=<hex>"
 * Set this in X-Microtask-Signature header so receivers can verify.
 */
const signPayload = (payload, secret) => {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${sig}`;
};

/**
 * Verify incoming webhook signature from external services.
 * Returns true if the signature matches.
 */
const verifySignature = (rawBody, receivedSig, secret) => {
  const expected = signPayload(rawBody, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(receivedSig)
    );
  } catch {
    return false;
  }
};

/**
 * Dispatch a webhook to an advertiser's registered URL.
 * Retries up to 3 times with exponential backoff.
 */
const dispatchWebhook = async (url, secret, event, data, retries = 3) => {
  const payload = {
    event,          // e.g. "completion.approved"
    timestamp: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Microtask-Signature': signature,
          'X-Microtask-Event': event,
        },
        timeout: 10000,
      });
      logger.info(`Webhook dispatched: ${event} → ${url} [${response.status}]`);
      return { success: true, status: response.status };
    } catch (err) {
      logger.warn(`Webhook attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  logger.error(`Webhook permanently failed: ${event} → ${url}`);
  return { success: false };
};

module.exports = { signPayload, verifySignature, dispatchWebhook };
