import Papa from "papaparse";
import type { ParseResult, StandardRow } from "./types";
import { parseShopifyDate } from "./dates";
import { inferProductType } from "./product-type";

function toNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Shopify's daily sales export has a row for every day of the period
 * (zero-filled on no-sales days) plus rows that are shipping-charge-only
 * (blank product title, non-zero "Total sales"). Both are noise for
 * royalty purposes and get dropped, not flagged as warnings.
 */
export function parseShopifyCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: StandardRow[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skippedRows = 0;

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const productTitle = raw["Product title at time of sale"]?.trim();
    if (!productTitle) {
      skippedRows += 1;
      return;
    }

    const dayRaw = raw["Day"]?.trim();
    if (!dayRaw) {
      warnings.push({ rowNumber, message: "Missing Day — row skipped" });
      return;
    }

    let saleDate: string;
    try {
      saleDate = parseShopifyDate(dayRaw);
    } catch (err) {
      warnings.push({ rowNumber, message: (err as Error).message });
      return;
    }

    const unitsSold = toNumber(raw["Quantity ordered"]) || 1;
    const totalNet = toNumber(raw["Net sales"]);

    rows.push({
      source: "shopify",
      saleDate,
      rawTitle: productTitle,
      productType: inferProductType(productTitle),
      listingDescription: productTitle,
      variant: raw["Product variant title"]?.trim() || undefined,
      unitsSold,
      unitNet: unitsSold > 0 ? totalNet / unitsSold : totalNet,
      totalNet,
    });
  });

  return { rows, warnings, skippedRows };
}
