import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";


export default async function MappingsPage() {
  const supabase = createServiceClient();
  const { data: mappings, error } = await supabase
    .from("game_mappings")
    .select("*, publishers(name)")
    .order("source")
    .order("priority", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Game mappings</h1>
        <Link href="/mappings/new" className="btn-primary">
          New mapping
        </Link>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Match</th>
              <th className="px-4 py-2">Game</th>
              <th className="px-4 py-2">Publisher</th>
              <th className="px-4 py-2">Royalty?</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(mappings ?? []).map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 capitalize">{m.source}</td>
                <td className="px-4 py-2">
                  <span className="text-neutral-400">{m.match_type === "exact" ? "=" : "⊃"}</span>{" "}
                  {m.match_pattern}
                  <span className="text-neutral-400"> ({m.match_field})</span>
                </td>
                <td className="px-4 py-2">{m.game_name}</td>
                <td className="px-4 py-2">{m.publishers?.name ?? "—"}</td>
                <td className="px-4 py-2">{m.royalty_applicable ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/mappings/${m.id}`} className="text-neutral-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(mappings ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                  No mappings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
