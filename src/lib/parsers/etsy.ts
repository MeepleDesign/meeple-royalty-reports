import Papa from "papaparse";
import type { ParseResult, StandardRow } from "./types";
import { parseEtsyDate } from "./dates";
import { inferProductType } from "./product-type";

function toNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export function parseEtsyCsv(csvText: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows: StandardRow[] = [];
  const warnings: ParseResult["warnings"] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-indexing
    const itemName = raw["Item Name"]?.trim();
    const saleDateRaw = raw["Sale Date"]?.trim();
    if (!itemName || !saleDateRaw) {
      warnings.push({ rowNumber, message: "Missing Item Name or Sale Date — row skipped" });
      return;
    }

    let saleDate: string;
    try {
      saleDate = parseEtsyDate(saleDateRaw);
    } catch (err) {
      warnings.push({ rowNumber, message: (err as Error).message });
      return;
    }

    const unitsSold = toNumber(raw["Quantity"]) || 1;
    const totalNet = toNumber(raw["Item Total"]);

    rows.push({
      source: "etsy",
      saleDate,
      rawTitle: itemName,
      rawSku: raw["SKU"]?.trim() || undefined,
      productType: inferProductType(itemName),
      listingDescription: itemName,
      variant: raw["Variations"]?.trim() || undefined,
      unitsSold,
      unitNet: unitsSold > 0 ? totalNet / unitsSold : totalNet,
      totalNet,
    });
  });

  return { rows, warnings, skippedRows: warnings.length };
}
