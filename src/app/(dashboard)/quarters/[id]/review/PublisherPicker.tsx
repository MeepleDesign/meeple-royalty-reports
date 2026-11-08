"use client";

import { forwardRef } from "react";

export const PublisherPicker = forwardRef<
  HTMLSelectElement,
  {
    name: string;
    publishers: { id: string; name: string }[];
    onAddNew: () => void;
  }
>(function PublisherPicker({ name, publishers, onAddNew }, ref) {
  return (
    <select
      ref={ref}
      name={name}
      required
      className="input"
      defaultValue=""
      onChange={(e) => {
        if (e.target.value === "__new__") {
          e.target.value = "";
          onAddNew();
        }
      }}
    >
      <option value="">— select —</option>
      {publishers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      <option value="__new__">+ Add new publisher…</option>
    </select>
  );
});
