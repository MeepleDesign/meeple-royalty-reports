import { NormalizationForm } from "../NormalizationForm";
import { createNormalization } from "../actions";

export default function NewNormalizationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New normalization rule</h1>
      <div className="card">
        <NormalizationForm action={createNormalization} />
      </div>
    </div>
  );
}
