"use client";

import { useState } from "react";
import Papa from "papaparse";

type FieldKey =
  | "sale_date"
  | "title"
  | "sku"
  | "variant"
  | "product_type"
  | "units_sold"
  | "total_net"
  | "status"
  | "order_no"
  | "ship_to_country";

const FIELDS: { key: FieldKey; label: string; required: boolean }[] = [
  { key: "sale_date", label: "Sale date", required: true },
  { key: "title", label: "Listing title / item name / “Work”", required: true },
  { key: "units_sold", label: "Units sold", required: true },
  { key: "total_net", label: "Total NET amount", required: true },
  { key: "sku", label: "SKU (optional)", required: false },
  { key: "variant", label: "Variant (optional)", required: false },
  { key: "product_type", label: "Product type (optional — only if the source has its own column for it)", required: false },
  { key: "status", label: "Order status (optional — used to exclude cancelled/refunded/pending orders)", required: false },
  { key: "order_no", label: "Order number (optional)", required: false },
  { key: "ship_to_country", label: "Ship to country (optional)", required: false },
];

export function SourceMappingForm({
  source,
  initial,
  isMapped,
  lastUpdated,
  action,
}: {
  source: string;
  initial: Partial<Record<FieldKey, string>>;
  isMapped: boolean;
  lastUpdated: string | null;
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
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm text-neutral-700 capitalize">{source}</div>
        <div className="flex items-center gap-2 text-xs">
          {isMapped ? (
            <span className="text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
              Mapped
            </span>
          ) : (
            <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Not mapped
            </span>
          )}
          {lastUpdated && (
            <span className="text-neutral-400">
              Last updated {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
        </div>
      </div>

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
