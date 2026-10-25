const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parses Redbubble's "23 Jul 26" / " 9 Jul 26" format (D MMM YY). */
export function parseRedbubbleDate(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})$/);
  if (!match) {
    throw new Error(`Unrecognized Redbubble date: "${raw}"`);
  }
  const [, day, monAbbr, yy] = match;
  const month = MONTHS[monAbbr.toLowerCase()];
  if (month === undefined) {
    throw new Error(`Unrecognized month in Redbubble date: "${raw}"`);
  }
  const year = 2000 + parseInt(yy, 10);
  return toIsoDate(year, month, parseInt(day, 10));
}

/**
 * Parses Etsy's "Sale Date" column. Etsy's export has used a few formats
 * historically ("Jul 23, 2026", sometimes with a time suffix like
 * "Jul 23, 2026 at 03:45 PM"). We haven't seen a real Etsy data row yet
 * (the sample file had headers only) — if this throws during the real
 * end-to-end test, check the actual string and extend this function.
 */
export function parseEtsyDate(raw: string): string {
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return toIsoDate(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  }
  const withoutTime = trimmed.split(/\s+at\s+/i)[0];
  const parsed = new Date(withoutTime);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Unrecognized Etsy date: "${raw}"`);
  }
  return toIsoDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** Shopify's "Day" column is already ISO (yyyy-mm-dd). */
export function parseShopifyDate(raw: string): string {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Unrecognized Shopify date: "${raw}"`);
  }
  return trimmed;
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
