-- Marks publishers that Meeple Design doesn't actually owe royalties to
-- (e.g. unlicensed/internal catch-all categories like "Miscellaneous").
-- Their sales still count in internal Analytics, but finalising a quarter
-- skips generating a royalty report/Drive folder for them.

alter table publishers
  add column pays_royalties boolean not null default true;
