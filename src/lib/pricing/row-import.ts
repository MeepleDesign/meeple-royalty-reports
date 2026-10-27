import type { SupabaseClient } from "@supabase/supabase-js";

export interface PriceRowImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export const PRICE_COLUMN_ALIASES: Record<string, string[]> = {
  price_id: ["price id", "id"],
  product_type: ["product type", "product_type", "product", "type"],
  variant: ["variant", "size"],
  unit_net: ["unit net", "unit_net", "unit net price", "price", "net"],
  notes: ["notes", "note"],
};

export function normalizeKey(key: string): string {
  return key
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findValue(row: Record<string, string>, field: keyof typeof PRICE_COLUMN_ALIASES): string | undefined {
  const normalizedRow = Object.entries(row).map(([k, v]) => [normalizeKey(k), v] as const);
  const aliases = PRICE_COLUMN_ALIASES[field];

  for (const alias of aliases) {
    const match = normalizedRow.find(([k]) => k === normalizeKey(alias));
    if (match && match[1]?.trim()) return match[1].trim();
  }
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias);
    const match = normalizedRow.find(([k]) => k.includes(normalizedAlias));
    if (match && match[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

export function missingPriceFieldMessage(field: keyof typeof PRICE_COLUMN_ALIASES, label: string): string {
  return `Missing ${label} — looked for a column named one of: ${PRICE_COLUMN_ALIASES[field].join(", ")}`;
}

export async function processPriceRow(
  supabase: SupabaseClient,
  row: Record<string, string>,
  rowNumber: number,
  result: PriceRowImportResult,
  existingId?: string
): Promise<void> {
  const productType = findValue(row, "product_type");
  const unitNetRaw = findValue(row, "unit_net");

  if (!productType) {
    result.errors.push({ row: rowNumber, message: missingPriceFieldMessage("product_type", "product type") });
    return;
  }
  if (!unitNetRaw) {
    result.errors.push({ row: rowNumber, message: missingPriceFieldMessage("unit_net", "unit NET price") });
    return;
  }
  const unitNet = parseFloat(unitNetRaw.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(unitNet)) {
    result.errors.push({ row: rowNumber, message: `Unit NET price "${unitNetRaw}" isn't a number` });
    return;
  }

  const values = {
    product_type: productType,
    variant: findValue(row, "variant") ?? null,
    unit_net: unitNet,
    notes: findValue(row, "notes") ?? null,
  };

  if (existingId) {
    const { error } = await supabase.from("product_prices").update(values).eq("id", existingId);
    if (error) {
      result.errors.push({ row: rowNumber, message: error.message });
      return;
    }
    result.updated += 1;
  } else {
    const { error } = await supabase.from("product_prices").insert(values);
    if (error) {
      result.errors.push({ row: rowNumber, message: error.message });
      return;
    }
    result.imported += 1;
  }
}
