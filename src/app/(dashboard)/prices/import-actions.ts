"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

export interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
  detectedColumns: string[];
  parseWarnings: string[];
}

const COLUMN_ALIASES: Record<string, string[]> = {
  product_type: ["product type", "product_type", "product", "type"],
  variant: ["variant", "size"],
  unit_net: ["unit net", "unit_net", "unit net price", "price", "net"],
  notes: ["notes", "note"],
};

function normalizeKey(key: string): string {
  return key
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findValue(row: Record<string, string>, field: keyof typeof COLUMN_ALIASES): string | undefined {
  const normalizedRow = Object.entries(row).map(([k, v]) => [normalizeKey(k), v] as const);
  const aliases = COLUMN_ALIASES[field];

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

function missingFieldMessage(field: keyof typeof COLUMN_ALIASES, label: string): string {
  return `Missing ${label} — looked for a column named one of: ${COLUMN_ALIASES[field].join(", ")} (check the "Detected columns" list below to see what was actually read from your file)`;
}

export async function importPricesCsv(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireOwner();
  const supabase = createServiceClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { imported: 0, errors: [{ row: 0, message: "No file selected" }], detectedColumns: [], parseWarnings: [] };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  const detectedColumns = parsed.meta.fields ?? [];
  const parseWarnings = parsed.errors.map((e) => `Row ${e.row != null ? e.row + 2 : "?"}: ${e.message}`);
  if (detectedColumns.length <= 1) {
    parseWarnings.unshift(
      `Only detected ${detectedColumns.length} column — if your file uses semicolons or tabs instead of commas, re-save it as a standard comma-separated CSV.`
    );
  }

  const errors: ImportResult["errors"] = [];
  const toInsert: Record<string, unknown>[] = [];

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;

    const productType = findValue(row, "product_type");
    const unitNetRaw = findValue(row, "unit_net");

    if (!productType) {
      errors.push({ row: rowNumber, message: missingFieldMessage("product_type", "product type") });
      return;
    }
    if (!unitNetRaw) {
      errors.push({ row: rowNumber, message: missingFieldMessage("unit_net", "unit NET price") });
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
      return { imported: 0, errors: [...errors, { row: 0, message: error.message }], detectedColumns, parseWarnings };
    }
  }

  revalidatePath("/prices");
  return { imported: toInsert.length, errors, detectedColumns, parseWarnings };
}
