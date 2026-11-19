'use strict';

// All business numbers live here so they can be changed without touching logic.
// Tile prices and estimating rules follow the Apache Roof Tiles company standard.

const env = process.env;
const num = (v, fallback) => (v === undefined || v === '' ? fallback : Number(v));

const config = {
  company: {
    name: 'Apache Roof Tiles',
    address: 'Plot 1127 Nkoyaphiri Industrial, Mogoditshane',
    phone: '+267 390-2306',
    email: 'sales1@apache.co.bw',
  },

  vatRate: 0.14,

  // 'retail' for the public / builders, 'wholesale' for developers & wholesalers.
  priceList: env.PRICE_LIST === 'wholesale' ? 'wholesale' : 'retail',

  // Pula, excluding VAT.
  prices: {
    retail: {
      doubleRoman: 7.81,
      shingleTuscan: 9.12,
      ridgeCap: 28.6,
      hipStarter: 33.86,
      oxidePerKg: 78.95,
      offloadPerPallet: 50,
    },
    wholesale: {
      doubleRoman: 6.95,
      shingleTuscan: 8.1,
      ridgeCap: 18.6,
      hipStarter: 20.5,
      oxidePerKg: 69.75,
      offloadPerPallet: 50,
    },
  },

  // ONE published roof price per m² of roof-plan area, for the main tile.
  // Includes tiles + ridge caps + oxide, incl. VAT. If PUBLISHED_PRICE_PER_M2 is
  // not set, it is worked out from the per-tile rates and rounded up to whole Pula
  // (retail: P140/m²). Set it to fix an approved figure.
  publishedPrice: {
    profile: 'Double Roman',
    perM2: num(env.PUBLISHED_PRICE_PER_M2, null),
  },

  estimating: {
    overhangFactor: 1.15, // +15% for overhang and pitch
    tilesPerM2: 11, // commercial quoting rate (includes cutting & breakage allowance)
    tileRoundTo: 50,
    ridgePercent: 0.06, // ridge caps = 6% of tiles
    ridgeRoundTo: 5,
    ridgeCapsPerOxideKg: 30,
    tilesPerPallet: 250,
  },

  freeDelivery: {
    // Product value (tiles + ridges + hips + oxide + membrane) incl VAT must exceed this.
    threshold: 14500,
    zones: [
      'Gaborone Central',
      'Phakalane',
      'Gaborone North',
      'Tlokweng',
      'Mmokolodi',
      'Gabane',
      'Kumakwane',
      'Mmopane',
    ],
  },

  // IBR (inverted box rib) sheeting used ONLY for the customer comparison.
  // Apache does not sell IBR, so the price MUST be set from a current local
  // supplier price. Until IBR_PRICE_PER_LM is set, the bot shows the sheet
  // quantity but no IBR cost.
  ibr: {
    label: env.IBR_LABEL || 'IBR 0.47 mm',
    pricePerLm: num(env.IBR_PRICE_PER_LM, null), // Pula per linear metre of sheet
    extrasPerM2: num(env.IBR_EXTRAS_PER_M2, 0), // optional: screws, flashing, ridge per m²
    pricesIncludeVat: env.IBR_PRICES_INCL_VAT === 'true',
    coverWidthM: num(env.IBR_COVER_WIDTH_M, 0.686), // standard IBR effective cover width
    wastePercent: num(env.IBR_WASTE_PERCENT, 0.05), // end laps and cutting
    areaFactor: num(env.IBR_AREA_FACTOR, 1.15), // same overhang allowance as tiles
  },

  limits: {
    minArea: 5,
    maxArea: 5000,
  },
};

module.exports = config;
