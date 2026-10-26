-- Adds Order No / Ship To Country as optional captured fields, and
-- Sale Source as a display label distinct from the internal `source` enum
-- (lets manual entries carry a free-text source label instead of the
-- literal word "manual").

alter table transactions
  add column order_no text,
  add column ship_to_country text,
  add column sale_source text;

-- Backfill existing rows with a sensible default label.
update transactions set sale_source = initcap(source) where sale_source is null;

alter table source_field_mappings drop constraint source_field_mappings_standard_field_check;
alter table source_field_mappings add constraint source_field_mappings_standard_field_check
  check (standard_field in (
    'sale_date', 'title', 'sku', 'variant', 'product_type', 'units_sold', 'total_net', 'status',
    'order_no', 'ship_to_country'
  ));
