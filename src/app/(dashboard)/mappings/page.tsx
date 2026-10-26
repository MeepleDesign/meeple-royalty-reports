import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ImportMappingsForm } from "./ImportMappingsForm";
import { SheetSyncControls } from "./SheetSyncControls";
import { deleteMapping, deleteAllMappings } from "./actions";

export const dynamic = "force-dynamic";

export default async function MappingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = createServiceClient();

  const { data: mappings, error } = await supabase
    .from("game_mappings")
    .select("*, publishers(name)")
    .order("game_name")
    .order("priority", { ascending: false });

  if (error) throw new Error(error.message);

  const needle = q?.trim().toLowerCase();
  const results = needle
    ? (mappings ?? []).filter(
        (m) =>
          m.game_name?.toLowerCase().includes(needle) ||
          m.match_pattern?.toLowerCase().includes(needle) ||
          m.notes?.toLowerCase().includes(needle) ||
          m.publishers?.name?.toLowerCase().includes(needle)
      )
    : mappings ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Board Game Publisher Mapping</h1>
        <div className="flex items-center gap-3">
          <form action={deleteAllMappings}>
            <button type="submit" className="btn-danger">
              Delete all
            </button>
          </form>
          <Link href="/mappings/new" className="btn-primary">
            New mapping
          </Link>
        </div>
      </div>

      <ImportMappingsForm />
      <SheetSyncControls />

      <form method="get" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search game, publisher, pattern, notes…"
          className="input max-w-sm"
        />
        <button type="submit" className="btn-secondary">
          Search
        </button>
        {q && (
          <Link href="/mappings" className="text-sm text-neutral-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Match</th>
              <th className="px-4 py-2">Game</th>
              <th className="px-4 py-2">Publisher</th>
              <th className="px-4 py-2">Royalty?</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {results.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2">
                  <span className="text-neutral-400">{m.match_type === "exact" ? "=" : "⊃"}</span>{" "}
                  {m.match_pattern}
                  <span className="text-neutral-400"> ({m.match_field})</span>
                </td>
                <td className="px-4 py-2">{m.game_name}</td>
                <td className="px-4 py-2">{m.publishers?.name ?? "—"}</td>
                <td className="px-4 py-2">{m.royalty_applicable ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Link href={`/mappings/${m.id}`} className="text-neutral-600 hover:underline mr-3">
                    Edit
                  </Link>
                  <form action={deleteMapping.bind(null, m.id)} className="inline">
                    <button type="submit" className="btn-danger">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                  {q ? "No mappings match your search." : "No mappings yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
