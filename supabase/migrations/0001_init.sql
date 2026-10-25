-- Meeple Design royalty reporting schema.
--
-- Access model: this is a single-user internal tool. All reads/writes go
-- through Next.js server code using the service-role key, after checking
-- the logged-in Supabase Auth user's email against APP_OWNER_EMAIL. RLS is
-- enabled with no policies, so the anon key (used only for the login screen)
-- can never read or write table data directly.

create extension if not exists "pgcrypto";

create table publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  royalty_rate numeric not null default 0.10,
  payment_basis text not null default 'quarterly'
    check (payment_basis in ('quarterly', 'annual')),
  annual_due_quarter int default 4 check (annual_due_quarter between 1 and 4),
  roll_forward boolean not null default false,
  payout_threshold numeric,
  email_template text,
  contact_email text,
  notes text,
  drive_folder_id text,
  created_at timestamptz not null default now()
);

create table game_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('etsy', 'shopify', 'redbubble', 'manual', 'any')),
  match_field text not null default 'title' check (match_field in ('title', 'sku')),
  match_type text not null default 'contains' check (match_type in ('exact', 'contains')),
  match_pattern text not null,
  game_name text not null,
  publisher_id uuid references publishers(id),
  royalty_applicable boolean not null default true,
  product_type_override text,
  priority int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index game_mappings_source_idx on game_mappings(source);

create table royalty_runs (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  quarter int not null check (quarter between 1 and 4),
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (year, quarter)
);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  royalty_run_id uuid not null references royalty_runs(id) on delete cascade,
  source text not null check (source in ('etsy', 'shopify', 'redbubble', 'manual')),
  filename text not null,
  row_count int not null default 0,
  uploaded_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  royalty_run_id uuid not null references royalty_runs(id) on delete cascade,
  upload_id uuid references uploads(id) on delete cascade,
  source text not null check (source in ('etsy', 'shopify', 'redbubble', 'manual')),
  sale_date date not null,
  raw_title text,
  raw_sku text,
  game_name text,
  publisher_id uuid references publishers(id),
  product_type text,
  listing_description text,
  variant text,
  units_sold numeric not null default 0,
  unit_net numeric,
  total_net numeric not null default 0,
  royalty_applicable boolean,
  mapping_id uuid references game_mappings(id),
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);
create index transactions_run_idx on transactions(royalty_run_id);
create index transactions_publisher_idx on transactions(publisher_id);
create index transactions_review_idx on transactions(royalty_run_id, needs_review);

create table publisher_balances (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references publishers(id) on delete cascade,
  royalty_run_id uuid not null references royalty_runs(id) on delete cascade,
  gross_revenue numeric not null default 0,
  units_sold numeric not null default 0,
  royalty_rate numeric not null,
  royalty_accrued numeric not null default 0,
  carried_in numeric not null default 0,
  carried_out numeric not null default 0,
  amount_payable numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'payable', 'carried_forward', 'not_yet_due', 'paid')),
  sheet_url text,
  sheet_file_id text,
  unique (publisher_id, royalty_run_id)
);

-- Cached Google Drive folder IDs so we don't re-query Drive on every run.
-- quarter is null for a year-level folder row, set for a quarter-level folder row.
create table publisher_drive_folders (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references publishers(id) on delete cascade,
  year int not null,
  quarter int check (quarter between 1 and 4),
  folder_id text not null,
  unique (publisher_id, year, quarter)
);

alter table publishers enable row level security;
alter table game_mappings enable row level security;
alter table royalty_runs enable row level security;
alter table uploads enable row level security;
alter table transactions enable row level security;
alter table publisher_balances enable row level security;
alter table publisher_drive_folders enable row level security;
-- No policies defined: anon/authenticated roles get zero access by default.
-- Server code uses the service-role key, which bypasses RLS entirely.
