type Normalisation = {
  raw_field?: string;
  match_type?: string;
  raw_pattern?: string;
  canonical_value?: string;
  priority?: number;
  notes?: string | null;
};

export function NormalisationForm({
  action,
  rule,
}: {
  action: (formData: FormData) => void | Promise<void>;
  rule?: Normalisation;
}) {
  return (
    <form action={action} className="space-y-5 max-w-xl">
      <Field label="Applies to">
        <select name="raw_field" defaultValue={rule?.raw_field ?? "product_type"} className="input">
          <option value="product_type">Product type</option>
          <option value="variant">Variant</option>
        </select>
      </Field>

      <Field label="Match type">
        <select name="match_type" defaultValue={rule?.match_type ?? "exact"} className="input">
          <option value="exact">Exact match</option>
          <option value="contains">Contains this text</option>
        </select>
      </Field>

      <Field label="Raw pattern (what the source reports, e.g. &quot;Premium T-Shirt&quot; or &quot;Small&quot;)">
        <input name="raw_pattern" defaultValue={rule?.raw_pattern} required className="input" />
      </Field>

      <Field label="Canonical value (what it should become, matching Standard Pricing, e.g. &quot;T-Shirt&quot; or &quot;S&quot;)">
        <input name="canonical_value" defaultValue={rule?.canonical_value} required className="input" />
      </Field>

      <Field label="Priority (higher wins when multiple patterns match)">
        <input name="priority" type="number" defaultValue={rule?.priority ?? 0} className="input" />
      </Field>

      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={rule?.notes ?? ""} className="input" />
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
