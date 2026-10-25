# Meeple Design — Royalty Reports

Internal tool for turning quarterly sales exports from Etsy, Shopify and
Redbubble (plus one manually-entered source) into per-publisher Google
Sheets royalty reports, with roll-forward and annual-accrual handling and
per-publisher email templates.

See [`SETUP.md`](./SETUP.md) for the one-time account setup (Supabase,
Google Cloud service account, Vercel).

## How it works

1. **Publishers** (`/publishers`) — one row per publisher: royalty rate
   (defaults to 10%), quarterly vs annual payment basis, roll-forward
   threshold, contact email, and a custom email template.
2. **Mappings** (`/mappings`) — rules that turn a raw listing title/SKU
   from a source file into a game + publisher + "does royalty apply"
   decision. Built up over time; unmatched rows get a one-time manual
   review that can save a new rule.
3. **Quarters** (`/`) — create a quarter, upload that quarter's Etsy
   (monthly), Shopify (single file) and Redbubble (monthly) exports, add
   any manual rows, resolve anything flagged for review, then **Finalize**.
4. Finalizing: computes each publisher's royalty for the quarter (with
   roll-forward-to-threshold and annual-accrual logic), writes a Google
   Sheet per publisher (tabs per source + a Summary tab) into
   `Royalty Reports/<Publisher>/<Year>/Q<N>` in Drive, and pre-creates the
   next quarter's (and, on Q4, next year's) folder.
5. **Analytics** (`/analytics`) — cross-publisher revenue/units by
   publisher, by source, and top games — internal only, not something any
   publisher sees.
6. **Email** (`/email`) — renders a publisher's custom template with that
   quarter's numbers filled in, ready to copy into your own email client.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values from SETUP.md
npm run dev
```

Apply `supabase/migrations/0001_init.sql` to your Supabase project (via the
SQL editor, or the Supabase CLI) before first use. Create your login user
under Supabase Authentication → Users, with the email in `APP_OWNER_EMAIL`.

## Stack

Next.js (App Router, server actions) · Supabase (Postgres + Auth) ·
Google Sheets/Drive API (service account) · Vercel.
