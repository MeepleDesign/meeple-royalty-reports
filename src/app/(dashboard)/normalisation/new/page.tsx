import { NormalisationForm } from "../NormalisationForm";
import { createNormalisation } from "../actions";

export default function NewNormalisationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New normalisation rule</h1>
      <div className="card">
        <NormalisationForm action={createNormalisation} />
      </div>
    </div>
  );
}
