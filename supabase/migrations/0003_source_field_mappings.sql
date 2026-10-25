-- Lets the user map each source's raw CSV column headers to the app's
-- standard fields, instead of the parser hardcoding column names. Seeded
-- with the mappings that matched the actual sample files reviewed when
-- this app was built, so nothing breaks if left untouched.

create table source_field_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('etsy', 'shopify', 'redbubble')),
  standard_field text not null check (
    standard_field in ('sale_date', 'title', 'sku', 'variant', 'product_type', 'units_sold', 'total_net', 'status')
  ),
  source_column text not null,
  updated_at timestamptz not null default now(),
  unique (source, standard_field)
);

alter table source_field_mappings enable row level security;
-- No policies: server code uses the service-role key, which bypasses RLS.

insert into source_field_mappings (source, standard_field, source_column) values
  ('etsy', 'sale_date', 'Sale Date'),
  ('etsy', 'title', 'Item Name'),
  ('etsy', 'sku', 'SKU'),
  ('etsy', 'variant', 'Variations'),
  ('etsy', 'units_sold', 'Quantity'),
  ('etsy', 'total_net', 'Item Total'),
  ('shopify', 'sale_date', 'Day'),
  ('shopify', 'title', 'Product title at time of sale'),
  ('shopify', 'variant', 'Product variant title'),
  ('shopify', 'units_sold', 'Quantity ordered'),
  ('shopify', 'total_net', 'Net sales'),
  ('redbubble', 'sale_date', 'Order Date'),
  ('redbubble', 'title', 'Work'),
  ('redbubble', 'product_type', 'Product'),
  ('redbubble', 'units_sold', 'Quantity'),
  ('redbubble', 'total_net', 'Artist Margin (GBP)'),
  ('redbubble', 'status', 'Status');
