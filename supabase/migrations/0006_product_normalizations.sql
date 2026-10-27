-- Rules that normalize the raw product type / variant text each source
-- reports (e.g. Redbubble's "Premium T-Shirt" / "Small") into the
-- canonical names used in Standard Pricing (e.g. "T-Shirt" / "S"), so the
-- pricing lookup actually matches instead of silently finding nothing.

create table product_normalizations (
  id uuid primary key default gen_random_uuid(),
  raw_field text not null check (raw_field in ('product_type', 'variant')),
  match_type text not null default 'exact' check (match_type in ('exact', 'contains')),
  raw_pattern text not null,
  canonical_value text not null,
  priority int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index product_normalizations_field_idx on product_normalizations(raw_field);

alter table product_normalizations enable row level security;
-- No policies: server code uses the service-role key, which bypasses RLS.
