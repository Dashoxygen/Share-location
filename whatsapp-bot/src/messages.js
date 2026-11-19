'use strict';

const defaultConfig = require('./config');
const { publishedRate } = require('./calculator');

const fmtInt = (n) => n.toLocaleString('en-US');
const fmtP = (n) =>
  'P ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function welcome(cfg = defaultConfig) {
  return [
    `👋 Dumela! Welcome to *${cfg.company.name}*.`,
    '',
    `Roof tiles from *${fmtP(publishedRate(cfg))} per m²* (${cfg.publishedPrice.profile}, incl. VAT).`,
    '',
    'Get a *free roof tile estimate* in seconds, plus a *free cost comparison with IBR sheeting*.',
    '',
    'Just send your roof size, e.g.:',
    '• *120* (square metres from your house plan)',
    '• *12 x 10* (length x width in metres)',
    '',
    'Other options:',
    '• *COLOURS* – our tile colours',
    '• *QUOTE* – get a formal quote from our sales team',
    '• *CONTACT* – call or visit us',
  ].join('\n');
}

function estimate(result, area, cfg = defaultConfig) {
  const t = result.tiles;
  const profile = cfg.publishedPrice.profile;
  const lines = [
    `🏠 *${cfg.company.name} – Free Roof Cost*`,
    '',
    `*Roof price: ${fmtP(t.ratePerM2)} per m²*`,
    `_${profile} tiles with ridge caps & oxide, incl. ${Math.round(cfg.vatRate * 100)}% VAT_`,
    '',
    `Your roof: ${fmtInt(area)} m² × ${fmtP(t.ratePerM2)}`,
    `*= ${fmtP(t.roofCost)}*`,
    '',
    '*You will need approximately:*',
    `• Roof tiles: *${fmtInt(t.tiles)}*`,
    `• Ridge caps: *${fmtInt(t.ridgeCaps)}*`,
    `• Pigment/oxide (for ridge mortar): *${t.oxideKg} kg*`,
    '',
    '_Also payable:_',
    `• Off-loading: ${fmtP(t.offloadingInclVat)} (${t.pallets} pallets)`,
    '• Delivery & diesel surcharge – depends on your location',
    '',
    '_Not included:_',
    `• Hip starters – 1 per outside corner of the roof, ${fmtP(t.hipStarterInclVat)} each (we count them from your plan)`,
    '• Timber, labour and undertile membrane',
  ];

  if (t.mayQualifyFreeDelivery) {
    lines.push(
      '',
      `🚚 Over ${fmtP(cfg.freeDelivery.threshold)} – *free delivery* may apply in: ` +
        `${cfg.freeDelivery.zones.join(', ')}. (Diesel surcharge and off-loading still apply.)`
    );
  }

  lines.push(
    '',
    `_Price per m² of house-plan area, for ${profile}. Shingle and Tuscan cost a little more – reply *QUOTE*. ` +
      'This is an estimate: your formal quote is counted from your roof plan. Tiles are for pitched roofs (17.5° and steeper)._'
  );
  return lines.join('\n');
}

function comparison(result, area, cfg = defaultConfig) {
  const { tiles, ibr, difference } = result;
  const lines = [
    '⚖️ *Free comparison: Tiles vs IBR sheeting*',
    `Same roof: ${fmtInt(area)} m² plan area`,
    '',
    `• ${ibr.label} sheeting needed: ~*${fmtInt(ibr.sheetMetres)} m* of sheet`,
  ];

  if (ibr.priced) {
    lines.push(
      `• IBR sheeting estimate: *${fmtP(ibr.inclVat)}*`,
      `• Apache ${cfg.publishedPrice.profile} tiles: *${fmtP(tiles.roofCost)}*`,
      ''
    );
    if (difference.amount > 0) {
      lines.push(`Tiles cost about *${fmtP(difference.amount)} more* (${difference.percent}%) up front.`);
    } else if (difference.amount < 0) {
      lines.push(`Tiles cost about *${fmtP(-difference.amount)} less* (${-difference.percent}%) than IBR.`);
    } else {
      lines.push('Tiles and IBR cost about the same for this roof.');
    }
  } else {
    lines.push(
      `• Apache ${cfg.publishedPrice.profile} tiles: *${fmtP(tiles.roofCost)}*`,
      '',
      'Reply *QUOTE* and we will send you current IBR pricing for a side-by-side comparison.'
    );
  }

  lines.push(
    '',
    '*Why many home owners choose tiles:*',
    '✅ No rust or corrosion',
    '✅ Much quieter in rain and hail',
    '✅ Keeps the house cooler in summer',
    '✅ Long life and a classic look that adds value',
    '',
    '_Comparison is materials only, incl. VAT. ' +
      (ibr.priced && ibr.includesExtras ? 'IBR includes an allowance for screws & flashing. ' : 'IBR excludes screws & flashing. ') +
      'Tile roofs need battens; IBR needs purlins. Timber and labour are not included for either._',
    '',
    'Reply *QUOTE* for a formal quote · *MENU* to start again'
  );
  return lines.join('\n');
}

function colours() {
  return [
    '🎨 *Apache tile colours*',
    'Terracotta · Red · Charcoal · Brown · Tan · Plum',
    'Two-tone options are also available (small surcharge).',
    '',
    'Profiles: *Double Roman*, *Shingle* (slate look) and *Tuscan*.',
    '',
    '_Brown, Tan and Plum are made to order and cannot be returned._',
    '',
    'Send your roof size (e.g. *120*) for a free estimate.',
  ].join('\n');
}

function contact(cfg = defaultConfig) {
  return [
    `📞 *${cfg.company.name}*`,
    cfg.company.address,
    `Tel: ${cfg.company.phone}`,
    `Email: ${cfg.company.email}`,
    '',
    'Send your roof size (e.g. *120*) for a free estimate, or *QUOTE* for a formal quote.',
  ].join('\n');
}

function askQuoteDetails(cfg = defaultConfig) {
  return [
    '📝 *Formal quote*',
    'Please reply in ONE message with:',
    '1. Name & surname',
    '2. Two contact numbers',
    '3. Building location (town / area)',
    '4. Tile colour and profile (Double Roman, Shingle or Tuscan)',
    '',
    `If you have a roof plan, email it to ${cfg.company.email} – we count hips and ridges from the plan for an exact quote.`,
    '',
    'Reply *CANCEL* to go back.',
  ].join('\n');
}

function quoteReceived(cfg = defaultConfig) {
  return [
    '✅ Thank you! Your details have been sent to our sales team. We will contact you shortly with a formal quote.',
    '',
    `Questions? Call ${cfg.company.phone}.`,
    'Reply *MENU* to start again.',
  ].join('\n');
}

function areaTooSmall(cfg = defaultConfig) {
  return `That looks very small for a roof. Please send the roof area in square metres (at least ${cfg.limits.minArea} m²), e.g. *120* or *12 x 10*.`;
}

function areaTooLarge(cfg = defaultConfig) {
  return [
    `That is a big project (over ${fmtInt(cfg.limits.maxArea)} m²)! 🏗️`,
    'Please reply *QUOTE* or call us on ' + cfg.company.phone + ' – our sales team will prepare a project quote and may offer developer pricing.',
    '',
    'If that was a typo, just send the area again, e.g. *120*.',
  ].join('\n');
}

function ambiguous() {
  return 'I found more than one number in your message. Please send just the roof area in m² (e.g. *120*) or the size as length x width (e.g. *12 x 10*).';
}

module.exports = {
  welcome,
  estimate,
  comparison,
  colours,
  contact,
  askQuoteDetails,
  quoteReceived,
  areaTooSmall,
  areaTooLarge,
  ambiguous,
  fmtP,
};
