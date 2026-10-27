import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { deleteNormalization } from "./actions";

export const dynamic = "force-dynamic";

export default async function NormalizationPage() {
  const supabase = createServiceClient();
  const { data: rules, error } = await supabase
    .from("product_normalizations")
    .select("*")
    .order("raw_field")
    .order("priority", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Product normalization</h1>
          <p className="text-sm text-neutral-500">
            Maps what a source actually reports (e.g. Redbubble&apos;s &quot;Premium T-Shirt&quot;)
            to the canonical name used in Standard Pricing (e.g. &quot;T-Shirt&quot;), so the
            pricing lookup on the royalty report actually finds a match. Applied automatically
            whenever a file is uploaded.
          </p>
        </div>
        <Link href="/normalization/new" className="btn-primary">
          New rule
        </Link>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Applies to</th>
              <th className="px-4 py-2">Match</th>
              <th className="px-4 py-2">Becomes</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(rules ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 capitalize">{r.raw_field.replace("_", " ")}</td>
                <td className="px-4 py-2">
                  <span className="text-neutral-400">{r.match_type === "exact" ? "=" : "⊃"}</span> {r.raw_pattern}
                </td>
                <td className="px-4 py-2 font-medium text-neutral-900">{r.canonical_value}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Link href={`/normalization/${r.id}`} className="text-neutral-600 hover:underline mr-3">
                    Edit
                  </Link>
                  <form action={deleteNormalization.bind(null, r.id)} className="inline">
                    <button type="submit" className="btn-danger">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(rules ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No normalization rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
