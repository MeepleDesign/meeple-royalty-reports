import { createServiceClient } from "@/lib/supabase/server";
import { resolveReviewRow } from "./actions";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const supabase = createServiceClient();

  const [{ data: rows }, { data: publishers }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("royalty_run_id", runId)
      .eq("needs_review", true)
      .order("source")
      .order("raw_title"),
    supabase.from("publishers").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">
        Needs review ({(rows ?? []).length})
      </h1>
      <p className="text-sm text-neutral-500">
        These rows didn&apos;t match any existing game mapping. Assign each one a game and
        publisher. Check &quot;save as rule&quot; to also apply this to future uploads (and to any
        other matching rows still waiting for review in this quarter).
      </p>

      <div className="space-y-4">
        {(rows ?? []).map((row) => (
          <div key={row.id} className="card">
            <div className="text-sm text-neutral-500 mb-3">
              <span className="uppercase tracking-wide text-xs bg-neutral-100 rounded px-2 py-0.5 mr-2">
                {row.source}
              </span>
              {row.raw_title}
              {row.raw_sku ? ` · SKU: ${row.raw_sku}` : ""} · £{Number(row.total_net).toFixed(2)}
            </div>

            <form action={resolveReviewRow.bind(null, runId, row.id)} className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-500 block">Game name</label>
                <input name="game_name" required className="input" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-500 block">Publisher</label>
                <select name="publisher_id" required className="input">
                  <option value="">— select —</option>
                  {(publishers ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input id={`royalty-${row.id}`} name="royalty_applicable" type="checkbox" defaultChecked />
                <label htmlFor={`royalty-${row.id}`} className="text-sm text-neutral-700">
                  Royalty applies
                </label>
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input id={`save-${row.id}`} name="save_as_rule" type="checkbox" defaultChecked />
                <label htmlFor={`save-${row.id}`} className="text-sm text-neutral-700">
                  Save as a rule for future uploads
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-500 block">Match on</label>
                <select name="match_field" defaultValue="title" className="input">
                  <option value="title">Title / item name</option>
                  <option value="sku">SKU</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-500 block">Match type</label>
                <select name="match_type" defaultValue="contains" className="input">
                  <option value="contains">Contains</option>
                  <option value="exact">Exact</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-neutral-500 block">Match pattern</label>
                <input name="match_pattern" defaultValue={row.raw_sku || row.raw_title} className="input" />
              </div>

              <div className="col-span-2">
                <button type="submit" className="btn-primary">
                  Resolve
                </button>
              </div>
            </form>
          </div>
        ))}

        {(rows ?? []).length === 0 && (
          <div className="card text-center text-neutral-400">Nothing left to review.</div>
        )}
      </div>
    </div>
  );
}
