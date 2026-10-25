type Publisher = { id: string; name: string };

type Mapping = {
  source?: string;
  match_field?: string;
  match_type?: string;
  match_pattern?: string;
  game_name?: string;
  publisher_id?: string | null;
  royalty_applicable?: boolean;
  product_type_override?: string | null;
  priority?: number;
  notes?: string | null;
};

export function MappingForm({
  action,
  mapping,
  publishers,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mapping?: Mapping;
  publishers: Publisher[];
}) {
  return (
    <form action={action} className="space-y-5 max-w-xl">
      <Field label="Source">
        <select name="source" defaultValue={mapping?.source ?? "any"} className="input">
          <option value="any">Any source</option>
          <option value="etsy">Etsy</option>
          <option value="shopify">Shopify</option>
          <option value="redbubble">Redbubble</option>
          <option value="manual">Manual</option>
        </select>
      </Field>

      <Field label="Match against">
        <select name="match_field" defaultValue={mapping?.match_field ?? "title"} className="input">
          <option value="title">Listing title / item name / &quot;Work&quot;</option>
          <option value="sku">SKU</option>
        </select>
      </Field>

      <Field label="Match type">
        <select name="match_type" defaultValue={mapping?.match_type ?? "contains"} className="input">
          <option value="contains">Contains this text</option>
          <option value="exact">Exact match</option>
        </select>
      </Field>

      <Field label="Match pattern (e.g. a game name fragment, or an exact SKU)">
        <input name="match_pattern" defaultValue={mapping?.match_pattern} required className="input" />
      </Field>

      <Field label="Game name">
        <input name="game_name" defaultValue={mapping?.game_name} required className="input" />
      </Field>

      <Field label="Publisher">
        <select name="publisher_id" defaultValue={mapping?.publisher_id ?? ""} className="input">
          <option value="">— none —</option>
          {publishers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center gap-2">
        <input
          id="royalty_applicable"
          name="royalty_applicable"
          type="checkbox"
          defaultChecked={mapping?.royalty_applicable ?? true}
        />
        <label htmlFor="royalty_applicable" className="text-sm text-neutral-700">
          Royalty applies (uncheck for unofficial / non-royalty products)
        </label>
      </div>

      <Field label="Product type override (optional — leave blank to auto-detect)">
        <input name="product_type_override" defaultValue={mapping?.product_type_override ?? ""} className="input" />
      </Field>

      <Field label="Priority (higher wins when multiple patterns match)">
        <input
          name="priority"
          type="number"
          defaultValue={mapping?.priority ?? 0}
          className="input"
        />
      </Field>

      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={mapping?.notes ?? ""} className="input" />
      </Field>

      <button type="submit" className="btn-primary">
        Save
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-neutral-700 block">{label}</label>
      {children}
    </div>
  );
}
