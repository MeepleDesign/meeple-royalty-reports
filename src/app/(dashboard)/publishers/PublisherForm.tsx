type Publisher = {
  name?: string;
  royalty_rate?: number;
  payment_basis?: string;
  annual_due_quarter?: number;
  roll_forward?: boolean;
  payout_threshold?: number | null;
  contact_email?: string | null;
  email_template?: string | null;
  notes?: string | null;
};

export function PublisherForm({
  action,
  publisher,
}: {
  action: (formData: FormData) => void | Promise<void>;
  publisher?: Publisher;
}) {
  return (
    <form action={action} className="space-y-5 max-w-xl">
      <Field label="Publisher name">
        <input
          name="name"
          defaultValue={publisher?.name}
          required
          className="input"
        />
      </Field>

      <Field label="Royalty rate (%)">
        <input
          name="royalty_rate"
          type="number"
          step="0.01"
          defaultValue={publisher ? (publisher.royalty_rate ?? 0.1) * 100 : 10}
          className="input"
        />
      </Field>

      <Field label="Payment basis">
        <select name="payment_basis" defaultValue={publisher?.payment_basis ?? "quarterly"} className="input">
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
      </Field>

      <Field label="If annual: due in quarter">
        <select name="annual_due_quarter" defaultValue={publisher?.annual_due_quarter ?? 4} className="input">
          <option value={1}>Q1</option>
          <option value={2}>Q2</option>
          <option value={3}>Q3</option>
          <option value={4}>Q4</option>
        </select>
      </Field>

      <div className="flex items-center gap-2">
        <input
          id="roll_forward"
          name="roll_forward"
          type="checkbox"
          defaultChecked={publisher?.roll_forward ?? false}
        />
        <label htmlFor="roll_forward" className="text-sm text-neutral-700">
          Roll unpaid balance forward until it clears a minimum threshold
        </label>
      </div>

      <Field label="Minimum payout threshold (£, only used if roll-forward is checked)">
        <input
          name="payout_threshold"
          type="number"
          step="0.01"
          defaultValue={publisher?.payout_threshold ?? ""}
          className="input"
        />
      </Field>

      <Field label="Contact email">
        <input
          name="contact_email"
          type="email"
          defaultValue={publisher?.contact_email ?? ""}
          className="input"
        />
      </Field>

      <Field label="Email template (placeholders: {{publisher}}, {{period}}, {{units_sold}}, {{gross_revenue}}, {{royalty_rate}}, {{royalty_due}}, {{carried_in}}, {{carried_out}}, {{status}})">
        <textarea
          name="email_template"
          rows={8}
          defaultValue={publisher?.email_template ?? ""}
          className="input font-mono text-xs"
        />
      </Field>

      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={publisher?.notes ?? ""} className="input" />
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
