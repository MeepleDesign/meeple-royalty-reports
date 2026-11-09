import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { PublisherForm } from "../PublisherForm";
import { updatePublisher, deletePublisher } from "../actions";

export default async function EditPublisherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
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
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      <div className="card">
        <PublisherForm action={updatePublisher.bind(null, id)} publisher={publisher} />
      </div>
    </div>
  );
}
