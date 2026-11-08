import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublisherRowImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

const FALSY = new Set(["no", "n", "false", "0"]);
const TRUTHY = new Set(["yes", "y", "true", "1"]);

export const PUBLISHER_COLUMN_ALIASES: Record<string, string[]> = {
  publisher_id: ["publisher id", "id"],
  name: ["name", "publisher name", "publisher"],
  royalty_rate: ["royalty rate", "royalty rate (%)", "rate", "royalty_rate"],
  payment_basis: ["payment basis", "basis", "payment_basis"],
  annual_due_quarter: ["annual due quarter", "due quarter", "annual_due_quarter"],
  roll_forward: ["roll forward", "roll-forward", "roll_forward"],
  payout_threshold: ["payout threshold", "minimum payout threshold", "threshold", "payout_threshold"],
  pays_royalties: ["pays royalties", "royalty?", "pay royalties", "pays_royalties"],
  contact_email: ["contact email", "email", "contact_email"],
  email_template: ["email template", "email_template"],
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

export function findValue(row: Record<string, string>, field: keyof typeof PUBLISHER_COLUMN_ALIASES): string | undefined {
  const normalisedRow = Object.entries(row).map(([k, v]) => [normaliseKey(k), v] as const);
  const aliases = PUBLISHER_COLUMN_ALIASES[field];

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

export function missingPublisherFieldMessage(field: keyof typeof PUBLISHER_COLUMN_ALIASES, label: string): string {
  return `Missing ${label} — looked for a column named one of: ${PUBLISHER_COLUMN_ALIASES[field].join(", ")}`;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const lower = raw.toLowerCase().trim();
  if (FALSY.has(lower)) return false;
  if (TRUTHY.has(lower)) return true;
  return fallback;
}

export async function processPublisherRow(
  supabase: SupabaseClient,
  row: Record<string, string>,
  rowNumber: number,
  result: PublisherRowImportResult,
  existingId?: string
): Promise<void> {
  const name = findValue(row, "name");
  if (!name) {
    result.errors.push({ row: rowNumber, message: missingPublisherFieldMessage("name", "publisher name") });
    return;
  }

  const royaltyRateRaw = findValue(row, "royalty_rate");
  const royaltyRate = royaltyRateRaw ? parseFloat(royaltyRateRaw.replace(/[^0-9.-]/g, "")) / 100 : 0.1;
  if (Number.isNaN(royaltyRate)) {
    result.errors.push({ row: rowNumber, message: `Royalty rate "${royaltyRateRaw}" isn't a number` });
    return;
  }

  const paymentBasisRaw = (findValue(row, "payment_basis") ?? "quarterly").toLowerCase();
  const paymentBasis = paymentBasisRaw === "annual" ? "annual" : "quarterly";

  const annualDueQuarterRaw = findValue(row, "annual_due_quarter");
  const annualDueQuarter = annualDueQuarterRaw ? parseInt(annualDueQuarterRaw, 10) || 4 : 4;

  const rollForward = parseBoolean(findValue(row, "roll_forward"), false);
  const payoutThresholdRaw = findValue(row, "payout_threshold");
  const payoutThreshold = rollForward && payoutThresholdRaw ? parseFloat(payoutThresholdRaw.replace(/[^0-9.-]/g, "")) : null;

  const paysRoyalties = parseBoolean(findValue(row, "pays_royalties"), true);

  const values = {
    name,
    royalty_rate: royaltyRate,
    payment_basis: paymentBasis,
    annual_due_quarter: annualDueQuarter,
    roll_forward: rollForward,
    payout_threshold: payoutThreshold,
    pays_royalties: paysRoyalties,
    contact_email: findValue(row, "contact_email") ?? null,
    email_template: findValue(row, "email_template") ?? null,
    notes: findValue(row, "notes") ?? null,
  };

  if (existingId) {
    const { error } = await supabase.from("publishers").update(values).eq("id", existingId);
    if (error) {
      result.errors.push({ row: rowNumber, message: error.message });
      return;
    }
    result.updated += 1;
  } else {
    const { error } = await supabase.from("publishers").insert(values);
    if (error) {
      result.errors.push({ row: rowNumber, message: error.message });
      return;
    }
    result.imported += 1;
  }
}
