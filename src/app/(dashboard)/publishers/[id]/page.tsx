import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { PublisherForm } from "../PublisherForm";
import { updatePublisher, deletePublisher } from "../actions";

export default async function EditPublisherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data: publisher } = await supabase.from("publishers").select("*").eq("id", id).single();

  if (!publisher) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">{publisher.name}</h1>
        <form action={deletePublisher.bind(null, id)}>
          <button type="submit" className="btn-danger">
            Delete publisher
          </button>
        </form>
      </div>
      <div className="card">
        <PublisherForm action={updatePublisher.bind(null, id)} publisher={publisher} />
      </div>
    </div>
  );
}
