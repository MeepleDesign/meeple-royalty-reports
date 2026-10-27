import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadFiles, addManualRow, deleteUpload } from "./actions";
import { finalizeQuarter } from "./finalize";
import { quarterLabel } from "@/lib/royalty/quarter";
import { ManualEntryForm } from "./ManualEntryForm";
import { ReapplyNormalizationButton } from "./ReapplyNormalizationButton";
import { findMissingPriceCombos } from "@/lib/pricing/gaps";

export default async function QuarterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const supabase = createServiceClient();

  const [
    { data: run },
    { data: uploads },
    { count: reviewCount },
    { data: publishers },
    { data: balances },
    { data: prices },
    missingPrices,
  ] = await Promise.all([
    supabase.from("royalty_runs").select("*").eq("id", runId).single(),
    supabase.from("uploads").select("*").eq("royalty_run_id", runId).order("uploaded_at"),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("royalty_run_id", runId)
      .eq("needs_review", true),
    supabase.from("publishers").select("id, name").order("name"),
    supabase.from("publisher_balances").select("*, publishers(name)").eq("royalty_run_id", runId),
    supabase.from("product_prices").select("id, product_type, variant, unit_net").order("product_type"),
    findMissingPriceCombos(supabase, runId),
  ]);

  if (!run) notFound();

  const label = quarterLabel(run.year, run.quarter);
  const needsReview = reviewCount ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">
          {label} <span className="text-neutral-400 text-sm font-normal capitalize">({run.status})</span>
        </h1>
        {run.status === "finalized" && (
          <span className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">
            Finalized {new Date(run.finalized_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {run.status === "draft" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <UploadCard runId={runId} source="etsy" label="Etsy (monthly files)" multiple />
            <UploadCard runId={runId} source="redbubble" label="Redbubble (monthly files)" multiple />
            <UploadCard runId={runId} source="shopify" label="Shopify (one file)" multiple={false} />
          </div>

          <ManualEntryForm
            publishers={publishers ?? []}
            prices={(prices ?? []).map((p) => ({ ...p, unit_net: Number(p.unit_net) }))}
            action={addManualRow.bind(null, runId)}
          />

          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 font-medium text-sm text-neutral-700">
              Uploads
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-neutral-100">
                {(uploads ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2 capitalize">{u.source}</td>
                    <td className="px-4 py-2">{u.filename}</td>
                    <td className="px-4 py-2">{u.row_count} rows</td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteUpload.bind(null, runId, u.id)}>
                        <button type="submit" className="btn-danger">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {(uploads ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                      No uploads yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {missingPrices.length > 0 && (
            <div className="card flex items-center justify-between">
              <Link href={`/quarters/${runId}/pricing-review`} className="text-amber-700 font-medium hover:underline">
                {missingPrices.length} product/variant combo(s) have no standard price — their Item
                Total will be blank on the report unless you add one →
              </Link>
              <ReapplyNormalizationButton runId={runId} />
            </div>
          )}

          <div className="card flex items-center justify-between">
            <div>
              {needsReview > 0 ? (
                <Link href={`/quarters/${runId}/review`} className="text-amber-700 font-medium hover:underline">
                  {needsReview} row(s) need review before you can finalize →
                </Link>
              ) : (
                <span className="text-green-700 font-medium">All rows mapped — ready to finalize</span>
              )}
            </div>
            <form action={finalizeQuarter.bind(null, runId)}>
              <button type="submit" disabled={needsReview > 0} className="btn-primary disabled:opacity-40">
                Finalize &amp; generate Sheets
              </button>
            </form>
          </div>
        </>
      )}

      {(balances ?? []).length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 font-medium text-sm text-neutral-700">
            Publisher balances
          </div>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-2">Publisher</th>
                <th className="px-4 py-2">Gross revenue</th>
                <th className="px-4 py-2">Royalty accrued</th>
                <th className="px-4 py-2">Payable</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(balances ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-medium text-neutral-900">{b.publishers?.name}</td>
                  <td className="px-4 py-2">£{Number(b.gross_revenue).toFixed(2)}</td>
                  <td className="px-4 py-2">£{Number(b.royalty_accrued).toFixed(2)}</td>
                  <td className="px-4 py-2">£{Number(b.amount_payable).toFixed(2)}</td>
                  <td className="px-4 py-2 capitalize">{b.status.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-right">
                    {b.sheet_url && (
                      <a href={b.sheet_url} target="_blank" className="text-neutral-600 hover:underline">
                        Open sheet
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UploadCard({
  runId,
  source,
  label,
  multiple,
}: {
  runId: string;
  source: "etsy" | "shopify" | "redbubble";
  label: string;
  multiple: boolean;
}) {
  return (
    <form action={uploadFiles.bind(null, runId, source)} className="card space-y-3">
      <div className="font-medium text-sm text-neutral-700">{label}</div>
      <input type="file" name="files" accept=".csv" multiple={multiple} required className="text-sm" />
      <button type="submit" className="btn-secondary w-full">
        Upload
      </button>
    </form>
  );
}
