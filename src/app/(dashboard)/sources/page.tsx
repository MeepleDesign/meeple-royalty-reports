import { createServiceClient } from "@/lib/supabase/server";
import { SourceMappingForm } from "./SourceMappingForm";
import { saveSourceMapping } from "./actions";

export const dynamic = "force-dynamic";

const SOURCES = ["etsy", "shopify", "redbubble"] as const;
const REQUIRED_FIELDS = ["sale_date", "title", "units_sold", "total_net"];

export default async function SourcesPage() {
  const supabase = createServiceClient();
  const { data: rows } = await supabase.from("source_field_mappings").select("*");

  const bySource: Record<string, Record<string, string>> = { etsy: {}, shopify: {}, redbubble: {} };
  const lastUpdatedBySource: Record<string, string | null> = { etsy: null, shopify: null, redbubble: null };
  for (const row of rows ?? []) {
    bySource[row.source][row.standard_field] = row.source_column;
    const current = lastUpdatedBySource[row.source];
    if (!current || row.updated_at > current) lastUpdatedBySource[row.source] = row.updated_at;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Source column mapping</h1>
        <p className="text-sm text-neutral-500">
          Tell the app which raw column in each platform&apos;s export holds which piece of data.
          Upload a sample file to pick columns from a dropdown, or just type the exact header text.
        </p>
      </div>

      {SOURCES.map((source) => {
        const isMapped = REQUIRED_FIELDS.every((f) => bySource[source][f]);
        return (
          <SourceMappingForm
            key={source}
            source={source}
            initial={bySource[source]}
            isMapped={isMapped}
            lastUpdated={lastUpdatedBySource[source]}
            action={saveSourceMapping.bind(null, source)}
          />
        );
      })}
    </div>
  );
}
