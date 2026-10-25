-- Standard pricing by product type + variant (e.g. "Poster" / "12x16",
-- "T-Shirt" / "XL"), used to auto-fill the NET amount on manual entries.
-- Etsy/Shopify/Redbubble already report actual sale amounts and are
-- unaffected by this table.

create table product_prices (
  id uuid primary key default gen_random_uuid(),
  product_type text not null,
  variant text,
  unit_net numeric not null,
  notes text,
  created_at timestamptz not null default now()
);
create index product_prices_lookup_idx on product_prices(product_type, variant);

alter table product_prices enable row level security;
-- No policies: server code uses the service-role key, which bypasses RLS.
