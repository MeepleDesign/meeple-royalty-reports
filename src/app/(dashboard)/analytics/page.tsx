import { createServiceClient } from "@/lib/supabase/server";
import { quarterLabel } from "@/lib/royalty/quarter";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run: selectedRunId } = await searchParams;
  const supabase = createServiceClient();

  const { data: runs } = await supabase
    .from("royalty_runs")
    .select("id, year, quarter")
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  let query = supabase.from("transactions").select("*, publishers(name)");
  if (selectedRunId) query = query.eq("royalty_run_id", selectedRunId);
  const { data: transactions } = await query;

  const rows = transactions ?? [];
  const totalRevenue = sum(rows.map((r) => Number(r.total_net)));

  const byPublisher = groupSum(rows, (r) => r.publishers?.name ?? "Unknown");
  const bySource = groupSum(rows, (r) => r.source);
  const byGame = groupSum(rows, (r) => r.game_name ?? "Unknown");
  const byProductType = groupSum(rows, (r) => r.product_type ?? "Unknown");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Analytics</h1>
        <form method="get" className="flex items-center gap-2">
          <select name="run" defaultValue={selectedRunId ?? ""} className="input w-auto">
            <option value="">All time</option>
            {(runs ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {quarterLabel(r.year, r.quarter)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            View
          </button>
        </form>
      </div>

      <div className="card">
        <div className="text-sm text-neutral-500">Total net revenue (all sources, incl. unofficial)</div>
        <div className="text-2xl font-semibold text-neutral-900">£{totalRevenue.toFixed(2)}</div>
      </div>

      <RankedTable title="Revenue by publisher" rows={byPublisher} total={totalRevenue} />
      <RankedTable title="Revenue by source" rows={bySource} total={totalRevenue} />
      <RankedTable title="Revenue by product type" rows={byProductType} total={totalRevenue} />
      <RankedTable title="Top games" rows={byGame} total={totalRevenue} limit={15} />

      <ProductTypeBySourceBreakdown rows={rows} />
    </div>
  );
}

/**
 * Internal-only: the real amount actually charged (total_net), broken
 * down by product type and source — this is the figure deliberately kept
 * off the publisher-facing Sheet (which shows a standard "Item Total"
 * from the pricing lookup instead), so it lives here for your own eyes.
 */
function ProductTypeBySourceBreakdown({
  rows,
}: {
  rows: { product_type: string | null; sale_source: string | null; source: string; total_net: number }[];
}) {
  const sources = Array.from(new Set(rows.map((r) => r.sale_source ?? r.source))).sort();
  const byProductType = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const productType = row.product_type ?? "Unknown";
    const source = row.sale_source ?? row.source;
    const bySource = byProductType.get(productType) ?? new Map<string, number>();
    bySource.set(source, (bySource.get(source) ?? 0) + Number(row.total_net));
    byProductType.set(productType, bySource);
  }

  const productTypes = Array.from(byProductType.keys()).sort();

  return (
    <details className="card p-0 overflow-hidden">
      <summary className="px-4 py-3 border-b border-neutral-100 font-medium text-sm text-neutral-700 cursor-pointer">
        Internal: actual charged amount by product type &amp; source (not shown to publishers)
      </summary>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-500">
          <tr>
            <th className="px-4 py-2">Product type</th>
            {sources.map((s) => (
              <th key={s} className="px-4 py-2 capitalize">
                {s}
              </th>
            ))}
            <th className="px-4 py-2">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {productTypes.map((pt) => {
            const bySource = byProductType.get(pt)!;
            const rowTotal = sum(Array.from(bySource.values()));
            return (
              <tr key={pt}>
                <td className="px-4 py-2 font-medium text-neutral-900">{pt}</td>
                {sources.map((s) => (
                  <td key={s} className="px-4 py-2">
                    {bySource.has(s) ? `£${bySource.get(s)!.toFixed(2)}` : "—"}
                  </td>
                ))}
                <td className="px-4 py-2 font-medium">£{rowTotal.toFixed(2)}</td>
              </tr>
            );
          })}
          {productTypes.length === 0 && (
            <tr>
              <td colSpan={sources.length + 2} className="px-4 py-6 text-center text-neutral-400">
                No data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </details>
  );
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function groupSum<T extends { total_net: number; units_sold: number }>(
  rows: T[],
  keyFn: (row: T) => string
): { key: string; revenue: number; units: number }[] {
  const map = new Map<string, { revenue: number; units: number }>();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = map.get(key) ?? { revenue: 0, units: 0 };
    existing.revenue += Number(row.total_net);
    existing.units += Number(row.units_sold);
    map.set(key, existing);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

function RankedTable({
  title,
  rows,
  total,
  limit,
}: {
  title: string;
  rows: { key: string; revenue: number; units: number }[];
  total: number;
  limit?: number;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 font-medium text-sm text-neutral-700">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Units</th>
            <th className="px-4 py-2">Revenue</th>
            <th className="px-4 py-2">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {shown.map((r) => (
            <tr key={r.key}>
              <td className="px-4 py-2 font-medium text-neutral-900 capitalize">{r.key}</td>
              <td className="px-4 py-2">{r.units}</td>
              <td className="px-4 py-2">£{r.revenue.toFixed(2)}</td>
              <td className="px-4 py-2">{total > 0 ? `${((r.revenue / total) * 100).toFixed(1)}%` : "—"}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                No data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
