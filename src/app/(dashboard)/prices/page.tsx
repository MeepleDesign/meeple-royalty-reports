import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ImportPricesForm } from "./ImportPricesForm";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const supabase = createServiceClient();
  const { data: prices, error } = await supabase
    .from("product_prices")
    .select("*")
    .order("product_type")
    .order("variant");

  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Standard pricing</h1>
          <p className="text-sm text-neutral-500">
            Used to auto-fill manual entries. Etsy/Shopify/Redbubble report their own actual sale
            amounts and don&apos;t use this.
          </p>
        </div>
        <Link href="/prices/new" className="btn-primary">
          New price
        </Link>
      </div>

      <ImportPricesForm />

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Product type</th>
              <th className="px-4 py-2">Variant</th>
              <th className="px-4 py-2">Unit NET</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(prices ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium text-neutral-900">{p.product_type}</td>
                <td className="px-4 py-2">{p.variant ?? "—"}</td>
                <td className="px-4 py-2">£{Number(p.unit_net).toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/prices/${p.id}`} className="text-neutral-600 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(prices ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No prices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
