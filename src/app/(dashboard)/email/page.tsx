import { createServiceClient } from "@/lib/supabase/server";
import { quarterLabel } from "@/lib/royalty/quarter";
import { renderTemplate } from "@/lib/email/render";
import { CopyButton } from "./CopyButton";

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ publisher?: string; run?: string }>;
}) {
  const { publisher: publisherId, run: runId } = await searchParams;
  const supabase = createServiceClient();

  const { data: publishers } = await supabase.from("publishers").select("*").order("name");
  const { data: runs } = await supabase
    .from("royalty_runs")
    .select("id, year, quarter")
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  let balance: Record<string, unknown> | null = null;
  let publisher: Record<string, unknown> | null = null;
  let rendered: string | null = null;

  if (publisherId && runId) {
    const [{ data: b }, { data: p }, { data: run }] = await Promise.all([
      supabase
        .from("publisher_balances")
        .select("*")
        .eq("publisher_id", publisherId)
        .eq("royalty_run_id", runId)
        .maybeSingle(),
      supabase.from("publishers").select("*").eq("id", publisherId).single(),
      supabase.from("royalty_runs").select("year, quarter").eq("id", runId).single(),
    ]);
    balance = b;
    publisher = p;

    if (p?.email_template && b && run) {
      rendered = renderTemplate(p.email_template, {
        publisher: p.name,
        period: quarterLabel(run.year, run.quarter),
        units_sold: String(b.units_sold),
        gross_revenue: `£${Number(b.gross_revenue).toFixed(2)}`,
        royalty_rate: `${(Number(b.royalty_rate) * 100).toFixed(1)}%`,
        royalty_due: `£${Number(b.amount_payable).toFixed(2)}`,
        carried_in: `£${Number(b.carried_in).toFixed(2)}`,
        carried_out: `£${Number(b.carried_out).toFixed(2)}`,
        status: String(b.status).replace("_", " "),
      });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Royalty email</h1>

      <form method="get" className="card grid grid-cols-3 gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-neutral-500 block">Publisher</label>
          <select name="publisher" defaultValue={publisherId ?? ""} className="input">
            <option value="">— select —</option>
            {(publishers ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-500 block">Quarter</label>
          <select name="run" defaultValue={runId ?? ""} className="input">
            <option value="">— select —</option>
            {(runs ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {quarterLabel(r.year, r.quarter)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Load
        </button>
      </form>

      {publisherId && runId && !balance && (
        <div className="card text-amber-700">
          No finalised balance for this publisher in this quarter yet — finalise the quarter first.
        </div>
      )}

      {publisherId && runId && balance && !publisher?.email_template && (
        <div className="card text-amber-700">
          This publisher has no email template set.{" "}
          <a href={`/publishers/${publisherId}`} className="underline">
            Add one
          </a>
          .
        </div>
      )}

      {rendered && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-500">Preview — edit before sending if needed</div>
            <CopyButton text={rendered} />
          </div>
          <pre className="whitespace-pre-wrap text-sm bg-neutral-50 border border-neutral-200 rounded p-4">
            {rendered}
          </pre>
        </div>
      )}
    </div>
  );
}
