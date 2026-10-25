import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { PriceForm } from "../PriceForm";
import { updatePrice, deletePrice } from "../actions";

export default async function EditPricePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data: price } = await supabase.from("product_prices").select("*").eq("id", id).single();

  if (!price) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">
          {price.product_type} {price.variant ? `— ${price.variant}` : ""}
        </h1>
        <form action={deletePrice.bind(null, id)}>
          <button type="submit" className="btn-danger">
            Delete price
          </button>
        </form>
      </div>
      <div className="card">
        <PriceForm action={updatePrice.bind(null, id)} price={price} />
      </div>
    </div>
  );
}
