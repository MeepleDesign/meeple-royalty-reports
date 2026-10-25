type Price = {
  product_type?: string;
  variant?: string | null;
  unit_net?: number;
  notes?: string | null;
};

export function PriceForm({
  action,
  price,
}: {
  action: (formData: FormData) => void | Promise<void>;
  price?: Price;
}) {
  return (
    <form action={action} className="space-y-5 max-w-xl">
      <Field label="Product type (e.g. Poster, T-Shirt, Mug)">
        <input name="product_type" defaultValue={price?.product_type} required className="input" />
      </Field>
      <Field label="Variant (e.g. 12x16, XL — leave blank if the product has no size/variant)">
        <input name="variant" defaultValue={price?.variant ?? ""} className="input" />
      </Field>
      <Field label="Unit NET price (£)">
        <input
          name="unit_net"
          type="number"
          step="0.01"
          defaultValue={price?.unit_net ?? ""}
          required
          className="input"
        />
      </Field>
      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={price?.notes ?? ""} className="input" />
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
