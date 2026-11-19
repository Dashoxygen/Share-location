'use strict';

const NUM = '(\\d+(?:\\.\\d+)?)';
const UNIT = '(?:\\s*(?:m|mt|mtr|metres?|meters?)\\b)?';

/**
 * Normalise "1,200" (thousands) vs "120,5" (decimal comma).
 */
function normaliseNumbers(text) {
  return text
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2') // 1,200 -> 1200
    .replace(/(\d),(\d)/g, '$1.$2'); // 120,5 -> 120.5
}

/**
 * Extract a roof area in m² from a customer message.
 * Accepts: "120", "120m2", "120 sqm", "120 square metres", "12 x 10", "12m by 10m".
 * Returns { area } on success, { ambiguous: true } when there are several
 * unrelated numbers, or null when there is no number at all.
 */
function parseArea(input) {
  if (!input) return null;
  const text = normaliseNumbers(String(input).toLowerCase()).replace(/²/g, '2');

  // Length × width
  const dims = text.match(new RegExp(`${NUM}${UNIT}\\s*(?:x|×|\\*|by)\\s*${NUM}${UNIT}`));
  if (dims) {
    return { area: round2(Number(dims[1]) * Number(dims[2])), fromDimensions: [Number(dims[1]), Number(dims[2])] };
  }

  // Number with an explicit area unit wins over any other number.
  const withUnit = text.match(new RegExp(`${NUM}\\s*(?:m2|sqm|sq\\.?\\s*m|m\\^2|square\\s*(?:metres?|meters?|m))`));
  if (withUnit) return { area: round2(Number(withUnit[1])) };

  const all = text.match(/\d+(?:\.\d+)?/g);
  if (!all) return null;
  if (all.length === 1) return { area: round2(Number(all[0])) };
  return { ambiguous: true };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { parseArea };
