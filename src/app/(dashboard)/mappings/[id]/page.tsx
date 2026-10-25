import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { MappingForm } from "../MappingForm";
import { updateMapping, deleteMapping } from "../actions";

export default async function EditMappingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();
  const [{ data: mapping }, { data: publishers }] = await Promise.all([
    supabase.from("game_mappings").select("*").eq("id", id).single(),
    supabase.from("publishers").select("id, name").order("name"),
  ]);

  if (!mapping) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">{mapping.game_name}</h1>
        <form action={deleteMapping.bind(null, id)}>
          <button type="submit" className="btn-danger">
            Delete mapping
          </button>
        </form>
      </div>
      <div className="card">
        <MappingForm action={updateMapping.bind(null, id)} mapping={mapping} publishers={publishers ?? []} />
      </div>
    </div>
  );
}
