"use client";

import { useRef, useState, useTransition } from "react";
import { resolveReviewRow } from "./actions";
import { createPublisherQuick } from "./publisher-actions";
import { PublisherPicker } from "./PublisherPicker";

type TransactionRow = {
  id: string;
  source: string;
  raw_title: string | null;
  raw_sku: string | null;
  total_net: number;
};

export function ReviewRows({
  runId,
  rows,
  initialPublishers,
}: {
  runId: string;
  rows: TransactionRow[];
  initialPublishers: { id: string; name: string }[];
}) {
  const [publishers, setPublishers] = useState(initialPublishers);
  const [modalRowId, setModalRowId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});

  function openModalFor(rowId: string) {
    setError(null);
    setNewName("");
    setModalRowId(rowId);
  }

  function closeModal() {
    setModalRowId(null);
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        const publisher = await createPublisherQuick(newName);
        setPublishers((prev) => [...prev, publisher].sort((a, b) => a.name.localeCompare(b.name)));
        const rowId = modalRowId;
        setModalRowId(null);
        setNewName("");
        if (rowId) {
          const select = selectRefs.current[rowId];
          if (select) select.value = publisher.id;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create publisher");
      }
    });
  }

  return (
    <>
      <div className="space-y-4">
        {rows.map((row) => (
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
                <PublisherPicker
                  name="publisher_id"
                  publishers={publishers}
                  ref={(el) => {
                    selectRefs.current[row.id] = el;
                  }}
                  onAddNew={() => openModalFor(row.id)}
                />
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
                <input name="match_pattern" defaultValue={row.raw_sku || row.raw_title || ""} className="input" />
              </div>

              <div className="col-span-2">
                <button type="submit" className="btn-primary">
                  Resolve
                </button>
              </div>
            </form>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="card text-center text-neutral-400">Nothing left to review.</div>
        )}
      </div>

      {modalRowId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-medium text-neutral-900">New publisher</h2>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Publisher name"
              className="input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary disabled:opacity-40"
                disabled={pending || !newName.trim()}
                onClick={handleCreate}
              >
                {pending ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
