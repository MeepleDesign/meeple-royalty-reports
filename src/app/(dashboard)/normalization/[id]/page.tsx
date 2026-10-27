import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { NormalizationForm } from "../NormalizationForm";
import { updateNormalization, deleteNormalization } from "../actions";

export default async function EditNormalizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data: rule } = await supabase.from("product_normalizations").select("*").eq("id", id).single();

  if (!rule) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">
          {rule.raw_pattern} → {rule.canonical_value}
        </h1>
        <form action={deleteNormalization.bind(null, id)}>
          <button type="submit" className="btn-danger">
            Delete rule
          </button>
        </form>
      </div>
      <div className="card">
        <NormalizationForm action={updateNormalization.bind(null, id)} rule={rule} />
      </div>
    </div>
  );
}
