import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";


export default async function PublishersPage() {
  const supabase = createServiceClient();
  const { data: publishers, error } = await supabase
    .from("publishers")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Publishers</h1>
        <Link href="/publishers/new" className="btn-primary">
          New publisher
        </Link>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">Basis</th>
              <th className="px-4 py-2">Roll-forward</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(publishers ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium text-neutral-900">{p.name}</td>
                <td className="px-4 py-2">{(p.royalty_rate * 100).toFixed(1)}%</td>
                <td className="px-4 py-2 capitalize">
                  {p.payment_basis}
                  {p.payment_basis === "annual" ? ` (Q${p.annual_due_quarter})` : ""}
                </td>
                <td className="px-4 py-2">
                  {p.roll_forward ? `Yes (threshold £${p.payout_threshold ?? 0})` : "No"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/publishers/${p.id}`} className="text-neutral-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(publishers ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  No publishers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
