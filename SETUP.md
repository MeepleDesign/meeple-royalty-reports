# Setup checklist

Steps you need to do yourself (account creation requires your own login). Collect
the values in **bold** as you go — they all end up as environment variables.

## 1. Supabase

1. Go to https://supabase.com → New project.
2. Any name (e.g. `meeple-royalty`), any region close to you.
3. Once created, go to **Project Settings → API**:
   - **`NEXT_PUBLIC_SUPABASE_URL`** — the Project URL
   - **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — the `anon` `public` key
   - **`SUPABASE_SERVICE_ROLE_KEY`** — the `service_role` key (keep secret — server-side only)
4. Go to **Project Settings → Database** and copy the connection string:
   - **`DATABASE_URL`** — use the "Connection pooling" URI (not the direct one), it works better from Vercel's serverless functions.

No need to create any tables yet — the schema migration (next build step) will do that.

## 2. Google Cloud service account (Sheets + Drive)

1. Go to https://console.cloud.google.com → create a new project (e.g. `meeple-royalty`).
2. In **APIs & Services → Library**, enable:
   - **Google Sheets API**
   - **Google Drive API**
3. In **APIs & Services → Credentials** → Create Credentials → **Service account**.
   - Any name (e.g. `royalty-report-bot`).
   - No roles needed (we only touch Sheets/Drive via sharing, not IAM).
4. Open the new service account → **Keys** tab → Add Key → **Create new key** → JSON. This downloads a `.json` file.
   - **`GOOGLE_SERVICE_ACCOUNT_EMAIL`** — the `client_email` field inside that JSON
   - **`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`** — the `private_key` field inside that JSON (keep the `\n` characters as-is; paste the whole string including `-----BEGIN PRIVATE KEY-----`)
5. In your own Google Drive, create a folder called e.g. **"Royalty Reports"**. This is the root folder everything gets organized under.
6. Right-click that folder → **Share** → paste in the service account's email (from `GOOGLE_SERVICE_ACCOUNT_EMAIL`) → give it **Editor** access.
7. Open the folder in the browser and copy its ID from the URL
   (`https://drive.google.com/drive/folders/`**`THIS_PART_IS_THE_ID`**):
   - **`ROYALTY_ROOT_FOLDER_ID`**

## 3. Vercel

1. Go to https://vercel.com → sign in / sign up, connect your GitHub account if not already.
2. Don't create the project yet — do this after the first code push (next step on my side). Once code is pushed:
   - **Add New → Project** → import `MeepleDesign/meeple-royalty-reports`.
   - In the project's **Settings → Environment Variables**, add every value collected above, plus anything else I flag once the app's scaffolded.
   - Deploy.

## What to send back to me

Once you have them, paste here (this chat is private to you, but let me know if you'd rather I use placeholder names and you fill the real values directly into Vercel yourself — that's actually the safer option, since then the real secrets never pass through chat):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `ROYALTY_ROOT_FOLDER_ID`
