import { PublisherForm } from "../PublisherForm";
import { createPublisher } from "../actions";

export default function NewPublisherPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New publisher</h1>
      <div className="card">
        <PublisherForm action={createPublisher} />
      </div>
    </div>
  );
}
