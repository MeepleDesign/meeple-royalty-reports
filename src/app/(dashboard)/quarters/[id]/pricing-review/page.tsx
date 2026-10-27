import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { findMissingPriceCombos } from "@/lib/pricing/gaps";
import { addMissingPrice, mapGapToExistingProduct } from "./actions";

export default async function PricingReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const supabase = createServiceClient();
  const gaps = await findMissingPriceCombos(supabase, runId);
  const { data: existingPrices } = await supabase
    .from("product_prices")
    .select("product_type, variant")
    .order("product_type")
    .order("variant");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Missing pricing ({gaps.length})</h1>
        <p className="text-sm text-neutral-500">
          These product/variant combos showed up in this quarter&apos;s sales but have no price in
          Standard Pricing, so their &quot;Item Total&quot; would be blank on the publisher report.
          Add a price for each — it&apos;s saved to Standard Pricing for future quarters too.
        </p>
      </div>

      <div className="space-y-4">
        {gaps.map((gap) => (
          <div key={`${gap.productType}|${gap.variant ?? ""}`} className="card">
            <div className="text-sm text-neutral-500 mb-3">
              <span className="font-medium text-neutral-900">{gap.productType}</span>
              {gap.variant ? ` — ${gap.variant}` : ""} · {gap.transactionCount} transaction
              {gap.transactionCount === 1 ? "" : "s"} affected
            </div>
            <form action={addMissingPrice.bind(null, runId)} className="flex items-end gap-3">
              <input type="hidden" name="product_type" value={gap.productType} />
              <input type="hidden" name="variant" value={gap.variant ?? ""} />
              <div className="space-y-1">
                <label className="text-xs text-neutral-500 block">Unit NET price (£)</label>
                <input name="unit_net" type="number" step="0.01" required className="input" />
              </div>
              <button type="submit" className="btn-primary">
                Save price
              </button>
            </form>

            {(existingPrices ?? []).length > 0 && (
              <form
                action={mapGapToExistingProduct.bind(null, runId)}
                className="flex items-end gap-3 mt-3 pt-3 border-t border-neutral-100"
              >
                <input type="hidden" name="raw_product_type" value={gap.productType} />
                <input type="hidden" name="raw_variant" value={gap.variant ?? ""} />
                <div className="space-y-1">
                  <label className="text-xs text-neutral-500 block">
                    …or this is actually the same as
                  </label>
                  <select name="canonical" required className="input">
                    <option value="">Choose an existing priced product…</option>
                    {(existingPrices ?? []).map((p) => (
                      <option
                        key={`${p.product_type}|${p.variant ?? ""}`}
                        value={`${p.product_type}||${p.variant ?? ""}`}
                      >
                        {p.product_type}
                        {p.variant ? ` — ${p.variant}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-secondary">
                  Map &amp; re-apply
                </button>
              </form>
            )}
          </div>
        ))}

        {gaps.length === 0 && (
          <div className="card text-center text-green-700">
            Every product/variant in this quarter has a price. You&apos;re all set.
          </div>
        )}
      </div>

      <Link href={`/quarters/${runId}`} className="text-sm text-neutral-600 hover:underline">
        ← Back to quarter
      </Link>
    </div>
  );
}
