-- Small key/value store for app-level state that isn't per-quarter or
-- per-publisher — currently just the Google Sheet ID used to mirror the
-- board game publisher mappings.

create table app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
-- No policies: server code uses the service-role key, which bypasses RLS.
