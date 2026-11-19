'use strict';

const defaultConfig = require('./config');

const EPS = 1e-9;
const roundUpTo = (n, step) => Math.ceil(n / step - EPS) * step;
const ceil = (n) => Math.ceil(n - EPS);
const money = (n) => Math.round(n * 100) / 100;

/**
 * The single published price per m² of roof-plan area for the main tile
 * (Double Roman): tiles + ridge caps + oxide, incl. VAT.
 * Derived from the per-tile rates using the same estimating rules, rounded up
 * to whole Pula, unless an approved figure is set in config.
 */
function derivePublishedRate(cfg = defaultConfig) {
  const e = cfg.estimating;
  const p = cfg.prices[cfg.priceList];
  const perTile =
    p.doubleRoman + e.ridgePercent * p.ridgeCap + (e.ridgePercent / e.ridgeCapsPerOxideKg) * p.oxidePerKg;
  return ceil(e.overhangFactor * e.tilesPerM2 * perTile * (1 + cfg.vatRate));
}

function publishedRate(cfg = defaultConfig) {
  const fixed = cfg.publishedPrice && cfg.publishedPrice.perM2;
  return fixed === null || fixed === undefined || Number.isNaN(fixed) ? derivePublishedRate(cfg) : fixed;
}

/**
 * Tile take-off and cost from a roof-plan footprint in m².
 * Follows the Apache estimating standard:
 *   tiles  = area × 1.15 × 11, rounded up to 50
 *   ridges = 6% of tiles, rounded up to 5
 *   oxide  = 1 kg per 30 ridge caps, rounded up
 *   pallets = tiles ÷ 250, rounded up
 * Hip starters are not included: they are counted from the roof plan.
 */
function calculateTiles(planArea, cfg = defaultConfig) {
  const e = cfg.estimating;
  const p = cfg.prices[cfg.priceList];
  const vat = 1 + cfg.vatRate;

  const roofArea = planArea * e.overhangFactor;
  const tiles = roundUpTo(roofArea * e.tilesPerM2, e.tileRoundTo);
  const ridgeCaps = roundUpTo(tiles * e.ridgePercent, e.ridgeRoundTo);
  const oxideKg = ceil(ridgeCaps / e.ridgeCapsPerOxideKg);
  const pallets = ceil(tiles / e.tilesPerPallet);

  const accessoriesExVat = ridgeCaps * p.ridgeCap + oxideKg * p.oxidePerKg;

  const profile = (tilePrice) => {
    const exVat = tiles * tilePrice + accessoriesExVat;
    return { exVat: money(exVat), inclVat: money(exVat * vat) };
  };

  const doubleRoman = profile(p.doubleRoman);
  const shingleTuscan = profile(p.shingleTuscan);
  const offloadingInclVat = money(pallets * p.offloadPerPallet * vat);
  const ratePerM2 = publishedRate(cfg);
  const roofCost = money(planArea * ratePerM2);

  return {
    planArea,
    roofArea: money(roofArea),
    tiles,
    ridgeCaps,
    oxideKg,
    pallets,
    doubleRoman,
    shingleTuscan,
    offloadingInclVat,
    hipStarterInclVat: money(p.hipStarter * vat),
    ratePerM2,
    roofCost, // published price × area – the figure customers see
    mayQualifyFreeDelivery: roofCost > cfg.freeDelivery.threshold,
    priceList: cfg.priceList,
  };
}

/**
 * IBR sheeting estimate for the same roof, for comparison only.
 * Sheet length = roof area ÷ cover width, plus waste allowance.
 */
function calculateIbr(planArea, cfg = defaultConfig) {
  const ibr = cfg.ibr;
  const roofArea = planArea * ibr.areaFactor;
  const sheetMetres = ceil((roofArea / ibr.coverWidthM) * (1 + ibr.wastePercent));

  if (ibr.pricePerLm === null || Number.isNaN(ibr.pricePerLm)) {
    return { roofArea: money(roofArea), sheetMetres, priced: false, label: ibr.label };
  }

  const raw = sheetMetres * ibr.pricePerLm + roofArea * ibr.extrasPerM2;
  const inclVat = ibr.pricesIncludeVat ? raw : raw * (1 + cfg.vatRate);

  return {
    roofArea: money(roofArea),
    sheetMetres,
    priced: true,
    inclVat: money(inclVat),
    includesExtras: ibr.extrasPerM2 > 0,
    label: ibr.label,
  };
}

function compare(planArea, cfg = defaultConfig) {
  const tiles = calculateTiles(planArea, cfg);
  const ibr = calculateIbr(planArea, cfg);
  let difference = null;
  if (ibr.priced) {
    const diff = money(tiles.roofCost - ibr.inclVat);
    difference = {
      amount: diff,
      percent: ibr.inclVat > 0 ? Math.round((diff / ibr.inclVat) * 100) : null,
    };
  }
  return { tiles, ibr, difference };
}

module.exports = { calculateTiles, calculateIbr, compare, roundUpTo, publishedRate, derivePublishedRate };
