"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

export interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

const COLUMN_ALIASES: Record<string, string[]> = {
  product_type: ["product type", "product_type", "product", "type"],
  variant: ["variant", "size"],
  unit_net: ["unit net", "unit_net", "unit net price", "price", "net"],
  notes: ["notes"],
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findValue(row: Record<string, string>, field: keyof typeof COLUMN_ALIASES): string | undefined {
  const normalizedRow: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) normalizedRow[normalizeKey(k)] = v;
  for (const alias of COLUMN_ALIASES[field]) {
    const value = normalizedRow[normalizeKey(alias)];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return undefined;
}

export async function importPricesCsv(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireOwner();
  const supabase = createServiceClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { imported: 0, errors: [{ row: 0, message: "No file selected" }] };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  const errors: ImportResult["errors"] = [];
  const toInsert: Record<string, unknown>[] = [];

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;

    const productType = findValue(row, "product_type");
    const unitNetRaw = findValue(row, "unit_net");

    if (!productType) {
      errors.push({ row: rowNumber, message: "Missing product type" });
      return;
    }
    if (!unitNetRaw) {
      errors.push({ row: rowNumber, message: "Missing unit NET price" });
      return;
    }
    const unitNet = parseFloat(unitNetRaw.replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(unitNet)) {
      errors.push({ row: rowNumber, message: `Unit NET price "${unitNetRaw}" isn't a number` });
      return;
    }

    toInsert.push({
      product_type: productType,
      variant: findValue(row, "variant") ?? null,
      unit_net: unitNet,
      notes: findValue(row, "notes") ?? null,
    });
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from("product_prices").insert(toInsert);
    if (error) {
      return { imported: 0, errors: [...errors, { row: 0, message: error.message }] };
    }
  }

  revalidatePath("/prices");
  return { imported: toInsert.length, errors };
}
