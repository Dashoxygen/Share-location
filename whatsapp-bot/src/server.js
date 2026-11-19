'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createBot } = require('./bot');
const { sendText, verifySignature, extractMessages } = require('./whatsapp');
const config = require('./config');

const PORT = Number(process.env.PORT || 3000);
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const SALES_NOTIFY_NUMBER = process.env.SALES_NOTIFY_NUMBER; // optional, digits only
const LEADS_FILE = process.env.LEADS_FILE || path.join(__dirname, '..', 'data', 'leads.jsonl');

function saveLead(lead) {
  console.log('[lead]', JSON.stringify(lead));
  try {
    fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
    fs.appendFileSync(LEADS_FILE, JSON.stringify(lead) + '\n');
  } catch (err) {
    console.error('[lead] could not write leads file:', err.message);
  }
  if (SALES_NOTIFY_NUMBER) {
    const body = [
      '🆕 *New quote request (WhatsApp bot)*',
      `From: +${lead.from}${lead.profileName ? ` (${lead.profileName})` : ''}`,
      lead.lastEstimateArea ? `Estimated roof: ${lead.lastEstimateArea} m²` : 'No estimate yet',
      '',
      lead.details,
    ].join('\n');
    // Note: free-form messages only deliver if this number messaged the bot in the last 24 h.
    sendText(SALES_NOTIFY_NUMBER, body).catch((err) => console.error('[lead] notify failed:', err.message));
  }
}

const bot = createBot({ config, onLead: saveLead });

// Meta retries webhooks; ignore messages we have already handled.
const seen = new Set();
function alreadySeen(id) {
  if (!id) return false;
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > 5000) seen.delete(seen.values().next().value);
  return false;
}

async function processPayload(payload) {
  for (const m of extractMessages(payload)) {
    if (alreadySeen(m.id)) continue;
    const text = m.text ?? '';
    const replies =
      m.text === null && m.type === 'image'
        ? [`📷 Thanks! This chat can only read text. Please email your roof plan to ${config.company.email}, or send your roof size here (e.g. *120*) for a quick estimate.`]
        : bot.handle(m.from, text, { name: m.name });
    for (const reply of replies) {
      try {
        await sendText(m.from, reply);
      } catch (err) {
        console.error('[send]', err.message);
        break;
      }
    }
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // Webhook verification handshake from Meta.
  if (req.method === 'GET' && url.pathname === '/webhook') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(challenge || '');
    }
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (req.method === 'POST' && url.pathname === '/webhook') {
    let raw;
    try {
      raw = await readBody(req);
    } catch {
      res.writeHead(413);
      return res.end();
    }
    if (APP_SECRET && !verifySignature(raw, req.headers['x-hub-signature-256'], APP_SECRET)) {
      res.writeHead(401);
      return res.end('Bad signature');
    }
    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      res.writeHead(400);
      return res.end('Bad JSON');
    }
    // Acknowledge immediately; Meta expects a fast 200.
    res.writeHead(200);
    res.end('EVENT_RECEIVED');
    processPayload(payload).catch((err) => console.error('[webhook]', err));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

if (require.main === module) {
  if (!VERIFY_TOKEN) console.warn('WARNING: WHATSAPP_VERIFY_TOKEN is not set – Meta cannot verify the webhook.');
  if (!APP_SECRET) console.warn('WARNING: WHATSAPP_APP_SECRET is not set – webhook signatures are NOT checked.');
  if (config.ibr.pricePerLm === null) console.warn('NOTE: IBR_PRICE_PER_LM is not set – the IBR comparison will show sheet metres but no IBR price.');
  server.listen(PORT, () => console.log(`Apache roof tile bot listening on :${PORT} (price list: ${config.priceList})`));
}

module.exports = { server, processPayload };
