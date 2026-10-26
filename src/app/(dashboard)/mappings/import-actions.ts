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

const SOURCES = new Set(["etsy", "shopify", "redbubble", "manual", "any"]);
const FALSY = new Set(["no", "n", "false", "0"]);

const COLUMN_ALIASES: Record<string, string[]> = {
  source: ["source", "platform"],
  match_field: ["match field", "match_field", "matchfield", "field"],
  match_type: ["match type", "match_type", "matchtype"],
  match_pattern: ["match pattern", "match_pattern", "pattern", "match text", "search term", "keyword", "text"],
  game_name: ["game name", "game_name", "game", "board game", "boardgame"],
  publisher_name: ["publisher name", "publisher_name", "publisher"],
  royalty_applicable: ["royalty applicable", "royalty_applicable", "royalty"],
  product_type_override: ["product type override", "product_type_override", "product type", "product_type"],
  priority: ["priority"],
  notes: ["notes", "note"],
};

function normalizeKey(key: string): string {
  return key
    .replace(/^﻿/, "") // strip a UTF-8 BOM, common from Excel exports
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Tries an exact alias match first; if none of the row's columns exactly
 * match an alias, falls back to "does this column's normalized name
 * contain the alias" (e.g. a column literally called "Search Pattern"
 * still satisfies the "pattern" alias for match_pattern).
 */
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

export async function importMappingsCsv(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
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
      errors.push({ row: rowNumber, message: missingFieldMessage("match_pattern", "match pattern") });
      return;
    }
    if (!gameName) {
      errors.push({ row: rowNumber, message: missingFieldMessage("game_name", "game name") });
      return;
    }
    if (!publisherName) {
      errors.push({ row: rowNumber, message: missingFieldMessage("publisher_name", "publisher name") });
      return;
    }
    const publisherId = publisherByName.get(publisherName.toLowerCase());
    if (!publisherId) {
      const known = (publishers ?? []).map((p) => p.name).join(", ") || "(none yet — add one under Publishers)";
      errors.push({
        row: rowNumber,
        message: `Publisher "${publisherName}" not found. Known publishers: ${known}`,
      });
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
      return { imported: 0, errors: [...errors, { row: 0, message: error.message }], detectedColumns, parseWarnings };
    }
  }

  revalidatePath("/mappings");
  return { imported: toInsert.length, errors, detectedColumns, parseWarnings };
}
