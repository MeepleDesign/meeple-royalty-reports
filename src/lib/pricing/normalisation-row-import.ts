import type { SupabaseClient } from "@supabase/supabase-js";

export interface NormalisationRowImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export const NORMALISATION_COLUMN_ALIASES: Record<string, string[]> = {
  rule_id: ["rule id", "id"],
  raw_field: ["applies to", "raw field", "raw_field", "field"],
  match_type: ["match type", "match_type", "matchtype"],
  raw_pattern: ["raw pattern", "raw_pattern", "pattern", "match", "from"],
  canonical_value: ["canonical value", "canonical_value", "becomes", "to", "canonical"],
  priority: ["priority"],
  notes: ["notes", "note"],
};

export function normaliseKey(key: string): string {
  return key
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findValue(
  row: Record<string, string>,
  field: keyof typeof NORMALISATION_COLUMN_ALIASES
): string | undefined {
  const normalisedRow = Object.entries(row).map(([k, v]) => [normaliseKey(k), v] as const);
  const aliases = NORMALISATION_COLUMN_ALIASES[field];

  for (const alias of aliases) {
    const match = normalisedRow.find(([k]) => k === normaliseKey(alias));
    if (match && match[1]?.trim()) return match[1].trim();
  }
  for (const alias of aliases) {
    const normalisedAlias = normaliseKey(alias);
    const match = normalisedRow.find(([k]) => k.includes(normalisedAlias));
    if (match && match[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

export function missingNormalisationFieldMessage(
  field: keyof typeof NORMALISATION_COLUMN_ALIASES,
  label: string
): string {
  return `Missing ${label} — looked for a column named one of: ${NORMALISATION_COLUMN_ALIASES[field].join(", ")}`;
}

export async function processNormalisationRow(
  supabase: SupabaseClient,
  row: Record<string, string>,
  rowNumber: number,
  result: NormalisationRowImportResult,
  existingId?: string
): Promise<void> {
  const rawFieldRaw = findValue(row, "raw_field")?.toLowerCase();
  const rawPattern = findValue(row, "raw_pattern");
  const canonicalValue = findValue(row, "canonical_value");

  if (!rawFieldRaw || (rawFieldRaw !== "product_type" && rawFieldRaw !== "variant")) {
    result.errors.push({
      row: rowNumber,
      message: `Unknown "applies to" value "${rawFieldRaw ?? ""}" (expected product_type/variant)`,
    });
    return;
  }
  if (!rawPattern) {
    result.errors.push({ row: rowNumber, message: missingNormalisationFieldMessage("raw_pattern", "raw pattern") });
    return;
  }
  if (!canonicalValue) {
    result.errors.push({ row: rowNumber, message: missingNormalisationFieldMessage("canonical_value", "canonical value") });
    return;
  }

  const matchTypeRaw = findValue(row, "match_type")?.toLowerCase() ?? "exact";
  if (matchTypeRaw !== "exact" && matchTypeRaw !== "contains") {
    result.errors.push({ row: rowNumber, message: `Unknown match type "${matchTypeRaw}" (expected exact/contains)` });
    return;
  }

  const priorityRaw = findValue(row, "priority");
  const priority = priorityRaw ? parseInt(priorityRaw, 10) || 0 : 0;

  const values = {
    raw_field: rawFieldRaw,
    match_type: matchTypeRaw,
    raw_pattern: rawPattern,
    canonical_value: canonicalValue,
    priority,
    notes: findValue(row, "notes") ?? null,
  };

  if (existingId) {
    const { error } = await supabase.from("product_normalizations").update(values).eq("id", existingId);
    if (error) {
      result.errors.push({ row: rowNumber, message: error.message });
      return;
    }
    result.updated += 1;
  } else {
    const { error } = await supabase.from("product_normalizations").insert(values);
    if (error) {
      result.errors.push({ row: rowNumber, message: error.message });
      return;
    }
    result.imported += 1;
  }
}
