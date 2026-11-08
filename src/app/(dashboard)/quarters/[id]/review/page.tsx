import { createServiceClient } from "@/lib/supabase/server";
import { ReviewRows } from "./ReviewRows";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const supabase = createServiceClient();

  const [{ data: rows }, { data: publishers }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, source, raw_title, raw_sku, total_net")
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

      <ReviewRows
        runId={runId}
        rows={(rows ?? []).map((r) => ({ ...r, total_net: Number(r.total_net) }))}
        initialPublishers={publishers ?? []}
      />
    </div>
  );
}
