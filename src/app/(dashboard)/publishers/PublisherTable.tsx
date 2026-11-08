"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { bulkUpdatePublishers, type BulkPublisherUpdate } from "./bulk-actions";

type Row = BulkPublisherUpdate;

export function PublisherTable({ initialPublishers }: { initialPublishers: Row[] }) {
  const [saved, setSaved] = useState(initialPublishers);
  const [rows, setRows] = useState(initialPublishers);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ updated: number; errors: { id: string; message: string }[] } | null>(null);

  const dirtyIds = useMemo(() => {
    const savedById = new Map(saved.map((r) => [r.id, r]));
    return new Set(
      rows
        .filter((r) => {
          const prev = savedById.get(r.id);
          return prev && JSON.stringify(prev) !== JSON.stringify(r);
        })
        .map((r) => r.id)
    );
  }, [rows, saved]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSaveAll() {
    const changed = rows.filter((r) => dirtyIds.has(r.id));
    if (changed.length === 0) return;
    setResult(null);
    startTransition(async () => {
      const res = await bulkUpdatePublishers(changed);
      setResult(res);
      const erroredIds = new Set(res.errors.map((e) => e.id));
      setSaved((prev) => {
        const byId = new Map(prev.map((r) => [r.id, r]));
        for (const row of changed) {
          if (!erroredIds.has(row.id)) byId.set(row.id, row);
        }
        return Array.from(byId.values());
      });
    });
  }

  const errorById = new Map((result?.errors ?? []).map((e) => [e.id, e.message]));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={pending || dirtyIds.size === 0}
          className="btn-primary disabled:opacity-40"
        >
          {pending ? "Saving…" : `Save all changes${dirtyIds.size > 0 ? ` (${dirtyIds.size})` : ""}`}
        </button>
        {result && !pending && (
          <span className="text-sm">
            {result.updated > 0 && <span className="text-green-700">Saved {result.updated}. </span>}
            {result.errors.length > 0 && <span className="text-red-600">{result.errors.length} failed.</span>}
          </span>
        )}
      </div>

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Rate (%)</th>
              <th className="px-4 py-2">Basis</th>
              <th className="px-4 py-2">Due Q (if annual)</th>
              <th className="px-4 py-2">Roll-forward</th>
              <th className="px-4 py-2">Threshold (£)</th>
              <th className="px-4 py-2">Pays royalties</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((p) => (
              <tr key={p.id} className={dirtyIds.has(p.id) ? "bg-amber-50" : undefined}>
                <td className="px-2 py-1">
                  <input
                    value={p.name}
                    onChange={(e) => updateRow(p.id, { name: e.target.value })}
                    className="input py-1"
                  />
                  {errorById.get(p.id) && (
                    <div className="text-xs text-red-600 mt-0.5">{errorById.get(p.id)}</div>
                  )}
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    value={Math.round(p.royalty_rate * 10000) / 100}
                    onChange={(e) => updateRow(p.id, { royalty_rate: parseFloat(e.target.value) / 100 })}
                    className="input py-1 w-20"
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={p.payment_basis}
                    onChange={(e) => updateRow(p.id, { payment_basis: e.target.value as "quarterly" | "annual" })}
                    className="input py-1"
                  >
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={p.annual_due_quarter}
                    disabled={p.payment_basis !== "annual"}
                    onChange={(e) => updateRow(p.id, { annual_due_quarter: parseInt(e.target.value, 10) })}
                    className="input py-1 disabled:opacity-40"
                  >
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                    <option value={3}>Q3</option>
                    <option value={4}>Q4</option>
                  </select>
                </td>
                <td className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={p.roll_forward}
                    onChange={(e) => updateRow(p.id, { roll_forward: e.target.checked })}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    value={p.payout_threshold ?? ""}
                    disabled={!p.roll_forward}
                    onChange={(e) =>
                      updateRow(p.id, {
                        payout_threshold: e.target.value === "" ? null : parseFloat(e.target.value),
                      })
                    }
                    className="input py-1 w-24 disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    checked={p.pays_royalties}
                    onChange={(e) => updateRow(p.id, { pays_royalties: e.target.checked })}
                  />
                </td>
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  <Link href={`/publishers/${p.id}`} className="text-neutral-600 hover:underline text-xs">
                    More…
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-400">
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
