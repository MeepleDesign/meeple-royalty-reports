import type { SupabaseClient } from "@supabase/supabase-js";

export interface PriceGap {
  productType: string;
  variant: string | null;
  transactionCount: number;
}

function key(productType: string | null, variant: string | null): string {
  return `${(productType ?? "").trim().toLowerCase()}|${(variant ?? "").trim().toLowerCase()}`;
}

/** Distinct product type / variant combos in a quarter's transactions that have no matching Standard Pricing row. */
export async function findMissingPriceCombos(supabase: SupabaseClient, runId: string): Promise<PriceGap[]> {
  const [{ data: txRows }, { data: prices }] = await Promise.all([
    supabase.from("transactions").select("product_type, variant").eq("royalty_run_id", runId),
    supabase.from("product_prices").select("product_type, variant"),
  ]);

  const priced = new Set((prices ?? []).map((p) => key(p.product_type, p.variant)));

  const gaps = new Map<string, PriceGap>();
  for (const row of txRows ?? []) {
    if (!row.product_type) continue; // can't look up or fill in a price with no product type at all
    const k = key(row.product_type, row.variant);
    if (priced.has(k)) continue;
    const existing = gaps.get(k);
    if (existing) {
      existing.transactionCount += 1;
    } else {
      gaps.set(k, { productType: row.product_type, variant: row.variant ?? null, transactionCount: 1 });
    }
  }

  return Array.from(gaps.values()).sort((a, b) => a.productType.localeCompare(b.productType));
}
