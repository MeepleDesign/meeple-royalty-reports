"use client";

import { useState } from "react";
import Papa from "papaparse";

type FieldKey = "sale_date" | "title" | "sku" | "variant" | "product_type" | "units_sold" | "total_net" | "status";

const FIELDS: { key: FieldKey; label: string; required: boolean }[] = [
  { key: "sale_date", label: "Sale date", required: true },
  { key: "title", label: "Listing title / item name / “Work”", required: true },
  { key: "units_sold", label: "Units sold", required: true },
  { key: "total_net", label: "Total NET amount", required: true },
  { key: "sku", label: "SKU (optional)", required: false },
  { key: "variant", label: "Variant (optional)", required: false },
  { key: "product_type", label: "Product type (optional — only if the source has its own column for it)", required: false },
  { key: "status", label: "Order status (optional — used to exclude cancelled/refunded/pending orders)", required: false },
];

export function SourceMappingForm({
  source,
  initial,
  action,
}: {
  source: string;
  initial: Partial<Record<FieldKey, string>>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>(initial);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    file.text().then((text) => {
      const parsed = Papa.parse<string[]>(text, { preview: 1 });
      const headerRow = parsed.data[0] ?? [];
      setHeaders(headerRow.filter(Boolean));
    });
  }

  return (
    <div className="card space-y-4">
      <div className="font-medium text-sm text-neutral-700 capitalize">{source}</div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-500 block">
          Upload a sample {source} CSV to pick columns from (optional — you can also just type column names below)
        </label>
        <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
        {fileName && <p className="text-xs text-neutral-400">Detected headers from {fileName}</p>}
      </div>

      <form action={action} className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs text-neutral-500 block">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </label>
            {headers.length > 0 ? (
              <select
                name={f.key}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="input"
              >
                <option value="">{f.required ? "— select —" : "— not used —"}</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
                {values[f.key] && !headers.includes(values[f.key]!) && (
                  <option value={values[f.key]}>{values[f.key]} (currently saved)</option>
                )}
              </select>
            ) : (
              <input
                name={f.key}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder="exact column header text"
                className="input"
              />
            )}
          </div>
        ))}
        <div className="col-span-2">
          <button type="submit" className="btn-primary">
            Save {source} mapping
          </button>
        </div>
      </form>
    </div>
  );
}
