import { PriceForm } from "../PriceForm";
import { createPrice } from "../actions";

export default function NewPricePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New price</h1>
      <div className="card">
        <PriceForm action={createPrice} />
      </div>
    </div>
  );
}
