'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const baseConfig = require('../src/config');
const { calculateTiles, calculateIbr, compare, publishedRate } = require('../src/calculator');
const { parseArea } = require('../src/parse');
const { createBot } = require('../src/bot');
const { verifySignature, extractMessages } = require('../src/whatsapp');
const crypto = require('node:crypto');

const withIbrPrice = (pricePerLm, extra = {}) => ({
  ...baseConfig,
  ibr: { ...baseConfig.ibr, pricePerLm, ...extra },
});

test('tile take-off follows the Apache estimating standard (120 m²)', () => {
  const r = calculateTiles(120, baseConfig);
  assert.equal(r.tiles, 1550); // 120 × 1.15 × 11 = 1518 → round up to 50
  assert.equal(r.ridgeCaps, 95); // 6% = 93 → round up to 5
  assert.equal(r.oxideKg, 4); // 95 / 30 = 3.17 → 4
  assert.equal(r.pallets, 7); // 1550 / 250 = 6.2 → 7
  assert.equal(r.doubleRoman.inclVat, 17257.66);
  assert.equal(r.shingleTuscan.inclVat, 19572.43);
  assert.equal(r.offloadingInclVat, 399);
  assert.equal(r.ratePerM2, 140);
  assert.equal(r.roofCost, 16800); // 120 m² × P140
  assert.equal(r.mayQualifyFreeDelivery, true);
});

test('published price per m² is derived from the per-tile rates', () => {
  // 1.15 × 11 × (7.81 + 6%×28.60 + 6%/30×78.95) × 1.14 = 139.65 → P140
  assert.equal(publishedRate(baseConfig), 140);
  // wholesale: 1.15 × 11 × (6.95 + 6%×18.60 + 6%/30×69.75) × 1.14 = 118.33 → P119
  assert.equal(publishedRate({ ...baseConfig, priceList: 'wholesale' }), 119);
  // an approved figure overrides the derived one
  const fixed = { ...baseConfig, publishedPrice: { ...baseConfig.publishedPrice, perM2: 150 } };
  assert.equal(publishedRate(fixed), 150);
  assert.equal(calculateTiles(100, fixed).roofCost, 15000);
  // small roof under the free-delivery threshold
  assert.equal(calculateTiles(80, baseConfig).mayQualifyFreeDelivery, false); // 80 × 140 = 11,200
});

test('tile take-off for 100 m² (float edge case on 1265 tiles)', () => {
  const r = calculateTiles(100, baseConfig);
  assert.equal(r.tiles, 1300);
  assert.equal(r.ridgeCaps, 80);
  assert.equal(r.oxideKg, 3);
  assert.equal(r.pallets, 6);
});

test('wholesale price list is used when configured', () => {
  const r = calculateTiles(120, { ...baseConfig, priceList: 'wholesale' });
  // 1550×6.95 + 95×18.60 + 4×69.75 = 10772.5 + 1767 + 279 = 12818.5 → ×1.14
  assert.equal(r.doubleRoman.inclVat, 14613.09);
});

test('IBR quantity without a configured price', () => {
  const r = calculateIbr(120, withIbrPrice(null));
  assert.equal(r.priced, false);
  assert.equal(r.sheetMetres, 212); // 138 / 0.686 × 1.05 = 211.2 → 212
});

test('IBR comparison with a configured price', () => {
  const r = compare(120, withIbrPrice(100));
  assert.equal(r.ibr.inclVat, 24168); // 212 × 100 × 1.14
  assert.equal(r.difference.amount, 16800 - 24168);
  const inclVat = calculateIbr(120, withIbrPrice(100, { pricesIncludeVat: true }));
  assert.equal(inclVat.inclVat, 21200);
});

test('parseArea understands common customer formats', () => {
  assert.deepEqual(parseArea('120'), { area: 120 });
  assert.deepEqual(parseArea('120m2'), { area: 120 });
  assert.deepEqual(parseArea('120 m²'), { area: 120 });
  assert.deepEqual(parseArea('My roof is 85.5 sqm'), { area: 85.5 });
  assert.deepEqual(parseArea('120,5'), { area: 120.5 });
  assert.deepEqual(parseArea('1,200 square metres'), { area: 1200 });
  assert.equal(parseArea('12 x 10').area, 120);
  assert.equal(parseArea('12m by 10m').area, 120);
  assert.equal(parseArea('3 bedroom house, 140 m2').area, 140);
  assert.deepEqual(parseArea('3 bedroom 2 bathroom'), { ambiguous: true });
  assert.equal(parseArea('hello'), null);
});

test('bot: greeting, estimate + comparison, limits', () => {
  const bot = createBot({ config: withIbrPrice(100) });
  assert.match(bot.handle('u1', 'Hi')[0], /free roof tile estimate/i);
  assert.match(bot.handle('u1', 'Hi')[0], /P 140\.00 per m²/);
  assert.match(bot.handle('u1', '?')[0], /free roof tile estimate/i);

  const replies = bot.handle('u1', '120 m2');
  assert.equal(replies.length, 2);
  assert.match(replies[0], /Roof tiles: \*1,550\*/);
  assert.match(replies[0], /Roof price: P 140\.00 per m²/);
  assert.match(replies[0], /P 16,800\.00/);
  assert.match(replies[1], /Tiles vs IBR/);
  assert.match(replies[1], /P 24,168\.00/);
  assert.match(replies[1], /less/);

  assert.match(bot.handle('u1', 'Hi, my roof is 120 m2')[0], /= P 16,800\.00/);
  assert.match(bot.handle('u1', '2')[0], /very small/);
  assert.match(bot.handle('u1', '20000')[0], /big project/);
  assert.match(bot.handle('u1', 'colours')[0], /Terracotta/);
  assert.doesNotMatch(bot.handle('u1', 'colours')[0], /Dolomite/);
});

test('bot: comparison without IBR price does not invent one', () => {
  const bot = createBot({ config: withIbrPrice(null) });
  const [, cmp] = bot.handle('u2', '120');
  assert.match(cmp, /212 m\* of sheet/);
  assert.doesNotMatch(cmp, /IBR sheeting estimate/);
});

test('bot: quote flow captures the lead with the last estimate', () => {
  const leads = [];
  const bot = createBot({ onLead: (l) => leads.push(l) });
  bot.handle('267711', '150');
  assert.match(bot.handle('267711', 'quote')[0], /Name & surname/);
  // Phone numbers in the details must not be treated as a roof area.
  assert.match(bot.handle('267711', 'Kabo Molefe 71234567 72345678 Mogoditshane Charcoal Double Roman')[0], /Thank you/);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].lastEstimateArea, 150);
  assert.match(leads[0].details, /Kabo Molefe/);

  bot.handle('267711', 'quote');
  assert.match(bot.handle('267711', 'cancel')[0], /free roof tile estimate/i);
  assert.equal(leads.length, 1);
});

test('bot: message from the roof-calculator page gets estimate + quote intake', () => {
  const leads = [];
  const bot = createBot({ onLead: (l) => leads.push(l) });
  const pageMsg = require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures', 'page-message.txt'), 'utf8');
  const replies = bot.handle('26772', pageMsg);
  assert.equal(replies.length, 3);
  assert.match(replies[0], /120 m² × P 140\.00/);
  assert.match(replies[0], /= P 16,800\.00/);
  assert.match(replies[2], /Name & surname/);
  bot.handle('26772', 'Kabo Molefe 71234567 72345678 Gabane Charcoal');
  assert.equal(leads[0].lastEstimateArea, 120);
});

test('webhook helpers: signature check and message extraction', () => {
  const body = Buffer.from('{"a":1}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  assert.equal(verifySignature(body, sig, 'secret'), true);
  assert.equal(verifySignature(body, sig, 'wrong'), false);
  assert.equal(verifySignature(body, undefined, 'secret'), false);

  const payload = {
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: '26771', profile: { name: 'Kabo' } }],
      messages: [
        { id: 'm1', from: '26771', type: 'text', text: { body: '120' } },
        { id: 'm2', from: '26771', type: 'image', image: {} },
      ],
    } }] }],
  };
  assert.deepEqual(extractMessages(payload), [
    { id: 'm1', from: '26771', type: 'text', text: '120', name: 'Kabo' },
    { id: 'm2', from: '26771', type: 'image', text: null, name: 'Kabo' },
  ]);
  assert.deepEqual(extractMessages({}), []);
});
