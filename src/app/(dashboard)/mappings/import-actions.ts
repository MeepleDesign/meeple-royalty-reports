"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/server-auth";
import { createServiceClient } from "@/lib/supabase/server";

export interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

const SOURCES = new Set(["etsy", "shopify", "redbubble", "manual", "any"]);
const FALSY = new Set(["no", "n", "false", "0"]);

const COLUMN_ALIASES: Record<string, string[]> = {
  source: ["source"],
  match_field: ["match field", "match_field", "matchfield"],
  match_type: ["match type", "match_type", "matchtype"],
  match_pattern: ["match pattern", "match_pattern", "pattern"],
  game_name: ["game name", "game_name", "game", "board game"],
  publisher_name: ["publisher name", "publisher_name", "publisher"],
  royalty_applicable: ["royalty applicable", "royalty_applicable", "royalty"],
  product_type_override: ["product type override", "product_type_override", "product type", "product_type"],
  priority: ["priority"],
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

export async function importMappingsCsv(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  await requireOwner();
  const supabase = createServiceClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { imported: 0, errors: [{ row: 0, message: "No file selected" }] };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  const { data: publishers } = await supabase.from("publishers").select("id, name");
  const publisherByName = new Map((publishers ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));

  const errors: ImportResult["errors"] = [];
  const toInsert: Record<string, unknown>[] = [];

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;

    const matchPattern = findValue(row, "match_pattern");
    const gameName = findValue(row, "game_name");
    const publisherName = findValue(row, "publisher_name");

    if (!matchPattern) {
      errors.push({ row: rowNumber, message: "Missing match pattern" });
      return;
    }
    if (!gameName) {
      errors.push({ row: rowNumber, message: "Missing game name" });
      return;
    }
    if (!publisherName) {
      errors.push({ row: rowNumber, message: "Missing publisher name" });
      return;
    }
    const publisherId = publisherByName.get(publisherName.toLowerCase());
    if (!publisherId) {
      errors.push({ row: rowNumber, message: `Publisher "${publisherName}" not found — add it under Publishers first` });
      return;
    }

    const sourceRaw = findValue(row, "source")?.toLowerCase() ?? "any";
    if (!SOURCES.has(sourceRaw)) {
      errors.push({ row: rowNumber, message: `Unknown source "${sourceRaw}" (expected etsy/shopify/redbubble/manual/any)` });
      return;
    }

    const matchFieldRaw = findValue(row, "match_field")?.toLowerCase() ?? "title";
    if (matchFieldRaw !== "title" && matchFieldRaw !== "sku") {
      errors.push({ row: rowNumber, message: `Unknown match field "${matchFieldRaw}" (expected title/sku)` });
      return;
    }

    const matchTypeRaw = findValue(row, "match_type")?.toLowerCase() ?? "contains";
    if (matchTypeRaw !== "exact" && matchTypeRaw !== "contains") {
      errors.push({ row: rowNumber, message: `Unknown match type "${matchTypeRaw}" (expected exact/contains)` });
      return;
    }

    const royaltyRaw = findValue(row, "royalty_applicable")?.toLowerCase();
    const royaltyApplicable = royaltyRaw === undefined ? true : FALSY.has(royaltyRaw) ? false : true;

    const priorityRaw = findValue(row, "priority");
    const priority = priorityRaw ? parseInt(priorityRaw, 10) || 0 : 0;

    toInsert.push({
      source: sourceRaw,
      match_field: matchFieldRaw,
      match_type: matchTypeRaw,
      match_pattern: matchPattern,
      game_name: gameName,
      publisher_id: publisherId,
      royalty_applicable: royaltyApplicable,
      product_type_override: findValue(row, "product_type_override") ?? null,
      priority,
      notes: findValue(row, "notes") ?? null,
    });
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from("game_mappings").insert(toInsert);
    if (error) {
      return { imported: 0, errors: [...errors, { row: 0, message: error.message }] };
    }
  }

  revalidatePath("/mappings");
  return { imported: toInsert.length, errors };
}
