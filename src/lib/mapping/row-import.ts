import type { SupabaseClient } from "@supabase/supabase-js";

export interface RowImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
  createdPublishers: string[];
}

const FALSY = new Set(["no", "n", "false", "0"]);

// Mappings aren't scoped to a platform — a title match should apply wherever
// that listing appears, not just the source it happened to be noticed on.
export const MAPPING_COLUMN_ALIASES: Record<string, string[]> = {
  mapping_id: ["mapping id", "id"],
  match_field: ["match field", "match_field", "matchfield", "field"],
  match_type: ["match type", "match_type", "matchtype"],
  // A bare "Match" column holds the pattern text itself in practice (e.g.
  // the full listing title), not a title/SKU indicator — match_field
  // already defaults sensibly to "title" when no column names it directly.
  match_pattern: ["match pattern", "match_pattern", "pattern", "match text", "search term", "keyword", "text", "match"],
  game_name: ["game name", "game_name", "game", "board game", "boardgame"],
  publisher_name: ["publisher name", "publisher_name", "publisher"],
  royalty_applicable: ["royalty applicable", "royalty_applicable", "royalty"],
  product_type_override: ["product type override", "product_type_override", "product type", "product_type"],
  priority: ["priority"],
  notes: ["notes", "note"],
};

export function normalizeKey(key: string): string {
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
export function findValue(
  row: Record<string, string>,
  field: keyof typeof MAPPING_COLUMN_ALIASES
): string | undefined {
  const normalizedRow = Object.entries(row).map(([k, v]) => [normalizeKey(k), v] as const);
  const aliases = MAPPING_COLUMN_ALIASES[field];

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

export function missingFieldMessage(field: keyof typeof MAPPING_COLUMN_ALIASES, label: string): string {
  return `Missing ${label} — looked for a column named one of: ${MAPPING_COLUMN_ALIASES[field].join(", ")}`;
}

/**
 * Processes one already-header-keyed row (from a CSV or a Sheet) into a
 * game_mappings insert/update, auto-creating the publisher if it doesn't
 * exist yet. Mutates `publisherByName` and `result` as it goes so repeated
 * calls across a batch share publisher lookups and accumulate one summary.
 *
 * `existingId` (from a "Mapping ID" column) makes this an update instead
 * of an insert — used for pulling edits back from a synced Google Sheet.
 */
export async function processMappingRow(
  supabase: SupabaseClient,
  row: Record<string, string>,
  rowNumber: number,
  publisherByName: Map<string, string>,
  result: RowImportResult,
  existingId?: string
): Promise<void> {
  let matchPattern = findValue(row, "match_pattern");
  let gameName = findValue(row, "game_name");
  const publisherName = findValue(row, "publisher_name");

  // Many spreadsheets use a single descriptive column for both "the game"
  // and "the text to match the listing on" — if only one of the two is
  // present, use it for both rather than failing the row.
  if (!matchPattern && gameName) matchPattern = gameName;
  else if (!gameName && matchPattern) gameName = matchPattern;

  if (!matchPattern) {
    result.errors.push({ row: rowNumber, message: missingFieldMessage("match_pattern", "match pattern") });
    return;
  }
  if (!gameName) {
    result.errors.push({ row: rowNumber, message: missingFieldMessage("game_name", "game name") });
    return;
  }
  if (!publisherName) {
    result.errors.push({ row: rowNumber, message: missingFieldMessage("publisher_name", "publisher name") });
    return;
  }

  let publisherId = publisherByName.get(publisherName.toLowerCase());
  if (!publisherId) {
    const { data: newPublisher, error: createError } = await supabase
      .from("publishers")
      .insert({ name: publisherName })
      .select("id")
      .single();
    if (createError || !newPublisher) {
      result.errors.push({ row: rowNumber, message: `Could not create publisher "${publisherName}": ${createError?.message}` });
      return;
    }
    publisherId = newPublisher.id as string;
    publisherByName.set(publisherName.toLowerCase(), publisherId);
    result.createdPublishers.push(publisherName);
  }

  const matchFieldRaw = findValue(row, "match_field")?.toLowerCase() ?? "title";
  if (matchFieldRaw !== "title" && matchFieldRaw !== "sku") {
    result.errors.push({ row: rowNumber, message: `Unknown match field "${matchFieldRaw}" (expected title/sku)` });
    return;
  }

  const matchTypeRaw = findValue(row, "match_type")?.toLowerCase() ?? "contains";
  if (matchTypeRaw !== "exact" && matchTypeRaw !== "contains") {
    result.errors.push({ row: rowNumber, message: `Unknown match type "${matchTypeRaw}" (expected exact/contains)` });
    return;
  }

  const royaltyRaw = findValue(row, "royalty_applicable")?.toLowerCase();
  const royaltyApplicable = royaltyRaw === undefined ? true : !FALSY.has(royaltyRaw);

  const priorityRaw = findValue(row, "priority");
  const priority = priorityRaw ? parseInt(priorityRaw, 10) || 0 : 0;

  const values = {
    source: "any",
    match_field: matchFieldRaw,
    match_type: matchTypeRaw,
    match_pattern: matchPattern,
    game_name: gameName,
    publisher_id: publisherId,
    royalty_applicable: royaltyApplicable,
    product_type_override: findValue(row, "product_type_override") ?? null,
    priority,
    notes: findValue(row, "notes") ?? null,
  };

  if (existingId) {
    const { error } = await supabase.from("game_mappings").update(values).eq("id", existingId);
    if (error) {
      result.errors.push({ row: rowNumber, message: error.message });
      return;
    }
    result.updated += 1;
  } else {
    const { error } = await supabase.from("game_mappings").insert(values);
    if (error) {
      result.errors.push({ row: rowNumber, message: error.message });
      return;
    }
    result.imported += 1;
  }
}
