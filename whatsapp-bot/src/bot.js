'use strict';

const defaultConfig = require('./config');
const { compare } = require('./calculator');
const { parseArea } = require('./parse');
const msg = require('./messages');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const KEYWORDS = {
  menu: /^(?:(?:hi+|hello|hey|hallo|dumela|good\s*(?:morning|afternoon|evening)|menu|start|help)\b|\?+$)/,
  quote: /^(quote|order|buy|formal quote)\b/,
  colours: /^(colou?rs?|profiles?)\b/,
  contact: /^(contact|call|phone|address|location|where)\b/,
  cancel: /^(cancel|back|stop)\b/,
};

/**
 * A tiny conversation engine. Stateless apart from:
 *  - the customer's last estimate (attached to their quote request)
 *  - whether we are waiting for their quote details
 */
function createBot({ config = defaultConfig, onLead = () => {}, now = () => Date.now() } = {}) {
  const sessions = new Map();

  function getSession(user) {
    const s = sessions.get(user);
    if (s && now() - s.updatedAt < SESSION_TTL_MS) return s;
    const fresh = { state: 'idle', lastArea: null, updatedAt: now() };
    sessions.set(user, fresh);
    return fresh;
  }

  /**
   * @param {string} user  sender id (WhatsApp number)
   * @param {string} text  message body
   * @param {object} [meta] e.g. { name } from the WhatsApp profile
   * @returns {string[]} replies to send, in order
   */
  function handle(user, text, meta = {}) {
    const session = getSession(user);
    session.updatedAt = now();
    const clean = String(text || '').trim();
    const lower = clean.toLowerCase();

    // A greeting only shows the menu when it carries no numbers, so
    // "Hi, my roof is 120 m²" still gets an estimate.
    const greetingOnly = KEYWORDS.menu.test(lower) && !/\d/.test(lower);
    if (KEYWORDS.cancel.test(lower) || greetingOnly) {
      session.state = 'idle';
      return [msg.welcome(config)];
    }

    if (session.state === 'awaiting_quote') {
      if (!clean) return [msg.askQuoteDetails(config)];
      session.state = 'idle';
      onLead({
        from: user,
        profileName: meta.name || null,
        details: clean,
        lastEstimateArea: session.lastArea,
        receivedAt: new Date(now()).toISOString(),
      });
      return [msg.quoteReceived(config)];
    }

    if (KEYWORDS.quote.test(lower)) {
      session.state = 'awaiting_quote';
      return [msg.askQuoteDetails(config)];
    }
    if (KEYWORDS.colours.test(lower)) return [msg.colours()];
    if (KEYWORDS.contact.test(lower)) return [msg.contact(config)];

    const parsed = parseArea(clean);
    if (!parsed) return [msg.welcome(config)];
    if (parsed.ambiguous) return [msg.ambiguous()];
    if (!(parsed.area >= config.limits.minArea)) return [msg.areaTooSmall(config)];
    if (parsed.area > config.limits.maxArea) return [msg.areaTooLarge(config)];

    session.lastArea = parsed.area;
    const result = compare(parsed.area, config);
    const replies = [msg.estimate(result, parsed.area, config), msg.comparison(result, parsed.area, config)];
    // Sent from the roof-calculator web page: estimate first, then collect quote details.
    if (/quote request/.test(lower)) {
      session.state = 'awaiting_quote';
      replies.push(msg.askQuoteDetails(config));
    }
    return replies;
  }

  return { handle, _sessions: sessions };
}

module.exports = { createBot };
