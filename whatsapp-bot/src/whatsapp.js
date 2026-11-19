'use strict';

const crypto = require('node:crypto');

const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';

/**
 * Send a plain text WhatsApp message through the Meta WhatsApp Cloud API.
 */
async function sendText(to, body, { token = process.env.WHATSAPP_TOKEN, phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID } = {}) {
  if (!token || !phoneNumberId) {
    throw new Error('WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be set');
  }
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`WhatsApp send failed (${res.status}): ${detail}`);
  }
  return res.json();
}

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw request body.
 */
function verifySignature(rawBody, header, appSecret) {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Pull incoming text messages out of a webhook payload.
 * Non-text messages (images, voice notes, locations) are returned with text = null.
 */
function extractMessages(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const names = new Map((value.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of value.messages || []) {
        let text = null;
        if (m.type === 'text') text = m.text?.body ?? null;
        else if (m.type === 'button') text = m.button?.text ?? null;
        else if (m.type === 'interactive') {
          text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
        }
        out.push({ id: m.id, from: m.from, type: m.type, text, name: names.get(m.from) || null });
      }
    }
  }
  return out;
}

module.exports = { sendText, verifySignature, extractMessages };
