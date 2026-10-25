import { createServiceClient } from "@/lib/supabase/server";
import { MappingForm } from "../MappingForm";
import { createMapping } from "../actions";

export default async function NewMappingPage() {
  const supabase = createServiceClient();
  const { data: publishers } = await supabase.from("publishers").select("id, name").order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New mapping</h1>
      <div className="card">
        <MappingForm action={createMapping} publishers={publishers ?? []} />
      </div>
    </div>
  );
}
