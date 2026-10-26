import Papa from "papaparse";
import type { ParseResult, Source, StandardRow } from "./types";
import { parseEtsyDate, parseShopifyDate, parseRedbubbleDate } from "./dates";
import { inferProductType } from "./product-type";

export interface FieldMapping {
  sale_date: string;
  title: string;
  sku?: string;
  variant?: string;
  product_type?: string;
  units_sold: string;
  total_net: string;
  status?: string;
  order_no?: string;
  ship_to_country?: string;
}

const DATE_PARSERS: Record<Source, (raw: string) => string> = {
  etsy: parseEtsyDate,
  shopify: parseShopifyDate,
  redbubble: parseRedbubbleDate,
  manual: (raw) => raw,
};

const SALE_SOURCE_LABELS: Record<"etsy" | "shopify" | "redbubble", string> = {
  etsy: "Etsy",
  shopify: "Shopify",
  redbubble: "Redbubble",
};

// Order statuses excluded from royalty totals when a `status` column is mapped
// (mainly relevant to Redbubble — nothing was reported paid-but-unfulfilled
// in our sample data, so this stays a fixed list rather than another
// per-source setting).
const EXCLUDED_STATUSES = new Set(["cancelled", "canceled", "refunded", "returned", "pending"]);

function toNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Parses a CSV using a user-configured column mapping (see `/sources`)
 * instead of hardcoded header names. Rows missing a title or date are
 * dropped silently — on Shopify's daily export that's what filters out
 * the no-sales-day padding rows and shipping-only line items, since both
 * have a blank product title.
 */
export function parseSourceCsv(
  source: "etsy" | "shopify" | "redbubble",
  csvText: string,
  mapping: FieldMapping
): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: StandardRow[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skippedRows = 0;

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const title = raw[mapping.title]?.trim();
    const saleDateRaw = raw[mapping.sale_date]?.trim();
    if (!title || !saleDateRaw) {
      skippedRows += 1;
      return;
    }

    if (mapping.status) {
      const status = raw[mapping.status]?.trim().toLowerCase();
      if (status && EXCLUDED_STATUSES.has(status)) {
        warnings.push({ rowNumber, message: `Status "${raw[mapping.status]}" excluded from royalty totals` });
        return;
      }
    }

    let saleDate: string;
    try {
      saleDate = DATE_PARSERS[source](saleDateRaw);
    } catch (err) {
      warnings.push({ rowNumber, message: (err as Error).message });
      return;
    }

    const unitsSold = toNumber(raw[mapping.units_sold]) || 1;
    const totalNet = toNumber(raw[mapping.total_net]);
    const productType = mapping.product_type ? raw[mapping.product_type]?.trim() : undefined;

    rows.push({
      source,
      saleDate,
      rawTitle: title,
      rawSku: mapping.sku ? raw[mapping.sku]?.trim() || undefined : undefined,
      productType: productType || inferProductType(title),
      listingDescription: title,
      variant: mapping.variant ? raw[mapping.variant]?.trim() || undefined : undefined,
      unitsSold,
      unitNet: unitsSold > 0 ? totalNet / unitsSold : totalNet,
      totalNet,
      orderNo: mapping.order_no ? raw[mapping.order_no]?.trim() || undefined : undefined,
      shipToCountry: mapping.ship_to_country ? raw[mapping.ship_to_country]?.trim() || undefined : undefined,
      saleSource: SALE_SOURCE_LABELS[source],
    });
  });

  return { rows, warnings, skippedRows };
}
