"use client";

import { useMemo, useState } from "react";

type Publisher = { id: string; name: string };
type Price = { id: string; product_type: string; variant: string | null; unit_net: number };

const CUSTOM = "__custom__";

export function ManualEntryForm({
  publishers,
  prices,
  action,
}: {
  publishers: Publisher[];
  prices: Price[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [priceId, setPriceId] = useState<string>(CUSTOM);
  const [units, setUnits] = useState<number>(1);
  const [totalNet, setTotalNet] = useState<string>("");
  const [productType, setProductType] = useState<string>("");
  const [variant, setVariant] = useState<string>("");

  const selectedPrice = useMemo(() => prices.find((p) => p.id === priceId), [priceId, prices]);

  function applyPrice(id: string, unitsValue: number) {
    setPriceId(id);
    const price = prices.find((p) => p.id === id);
    if (price) {
      setProductType(price.product_type);
      setVariant(price.variant ?? "");
      setTotalNet((price.unit_net * unitsValue).toFixed(2));
    }
  }

  return (
    <div className="card space-y-3">
      <div className="font-medium text-sm text-neutral-700">Manual entry (4th source)</div>
      <form action={action} className="grid grid-cols-4 gap-3">
        <input name="sale_date" type="date" required className="input" />
        <input name="game_name" placeholder="Game" required className="input" />
        <select name="publisher_id" required className="input">
          <option value="">Publisher…</option>
          {publishers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={priceId}
          onChange={(e) => applyPrice(e.target.value, units)}
          className="input"
        >
          <option value={CUSTOM}>Custom product…</option>
          {prices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.product_type}
              {p.variant ? ` — ${p.variant}` : ""} (£{p.unit_net.toFixed(2)})
            </option>
          ))}
        </select>

        <input
          name="product_type"
          placeholder="Product (e.g. Poster)"
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          disabled={!!selectedPrice}
          className="input"
        />
        <input
          name="variant"
          placeholder="Variant"
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          disabled={!!selectedPrice}
          className="input"
        />
        <input name="listing_description" placeholder="Listing description" required className="input col-span-2" />

        <input
          name="units_sold"
          type="number"
          step="1"
          value={units}
          onChange={(e) => {
            const next = parseFloat(e.target.value) || 0;
            setUnits(next);
            if (selectedPrice) setTotalNet((selectedPrice.unit_net * next).toFixed(2));
          }}
          placeholder="Units"
          required
          className="input"
        />
        <input
          name="total_net"
          type="number"
          step="0.01"
          value={totalNet}
          onChange={(e) => setTotalNet(e.target.value)}
          placeholder="Total NET £"
          required
          className="input"
        />
        <div className="flex items-center gap-2">
          <input id="manual-royalty" name="royalty_applicable" type="checkbox" defaultChecked />
          <label htmlFor="manual-royalty" className="text-sm text-neutral-700">
            Royalty applies
          </label>
        </div>
        <button type="submit" className="btn-secondary">
          Add row
        </button>
      </form>
    </div>
  );
}
