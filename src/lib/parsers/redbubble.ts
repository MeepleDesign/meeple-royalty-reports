import Papa from "papaparse";
import type { ParseResult, StandardRow } from "./types";
import { parseRedbubbleDate } from "./dates";

function toNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Only count orders that actually paid out; everything else is excluded with a warning. */
const EXCLUDED_STATUSES = new Set(["cancelled", "canceled", "refunded", "returned", "pending"]);

export function parseRedbubbleCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: StandardRow[] = [];
  const warnings: ParseResult["warnings"] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const work = raw["Work"]?.trim();
    const orderDateRaw = raw["Order Date"]?.trim();
    if (!work || !orderDateRaw) {
      warnings.push({ rowNumber, message: "Missing Work or Order Date — row skipped" });
      return;
    }

    const status = raw["Status"]?.trim().toLowerCase();
    if (status && EXCLUDED_STATUSES.has(status)) {
      warnings.push({ rowNumber, message: `Status "${raw["Status"]}" excluded from royalty totals` });
      return;
    }

    let saleDate: string;
    try {
      saleDate = parseRedbubbleDate(orderDateRaw);
    } catch (err) {
      warnings.push({ rowNumber, message: (err as Error).message });
      return;
    }

    const unitsSold = toNumber(raw["Quantity"]) || 1;
    const totalNet = toNumber(raw["Artist Margin (GBP)"]);

    rows.push({
      source: "redbubble",
      saleDate,
      rawTitle: work,
      productType: raw["Product"]?.trim() || undefined,
      listingDescription: work,
      variant: undefined,
      unitsSold,
      unitNet: unitsSold > 0 ? totalNet / unitsSold : totalNet,
      totalNet,
    });
  });

  return { rows, warnings, skippedRows: 0 };
}
