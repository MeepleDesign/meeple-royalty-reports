import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";


export default async function QuartersPage() {
  const supabase = createServiceClient();
  const { data: runs } = await supabase
    .from("royalty_runs")
    .select("*")
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Quarters</h1>
        <Link href="/quarters/new" className="btn-primary">
          New quarter
        </Link>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Quarter</th>
              <th className="px-4 py-2">Dates</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(runs ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-neutral-900">
                  {r.year} Q{r.quarter}
                </td>
                <td className="px-4 py-2">
                  {r.start_date} – {r.end_date}
                </td>
                <td className="px-4 py-2 capitalize">{r.status}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/quarters/${r.id}`} className="text-neutral-600 hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {(runs ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No quarters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
