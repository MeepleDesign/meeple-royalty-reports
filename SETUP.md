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

## 2. Google OAuth (Sheets + Drive)

Service-account keys are blocked by your Cloud org's "secure by default"
policy, so the app authorizes as **your own Google account** instead —
no key files, and no folder-sharing step needed since it's already your
Drive.

1. Go to https://console.cloud.google.com → create a new project (e.g. `meeple-royalty`), if you haven't already.
2. In **APIs & Services → Library**, enable:
   - **Google Sheets API**
   - **Google Drive API**
3. **APIs & Services → OAuth consent screen**:
   - User type: **Internal** if offered (your Workspace org) — otherwise **External**.
   - Fill in the required app name/support email fields, save through the wizard. Leave it in **Testing** status — no Google review needed since only you'll use it. If it's External, add `boardgames@meepledesign.com` under **Test users**.
4. **APIs & Services → Credentials** → **+ Create Credentials → OAuth client ID**.
   - Application type: **Desktop app**.
   - Any name (e.g. `royalty-report-cli`) → **Create**.
   - Copy the **Client ID** and **Client secret** shown:
     - **`GOOGLE_OAUTH_CLIENT_ID`**
     - **`GOOGLE_OAUTH_CLIENT_SECRET`**
5. Get a refresh token via Google's OAuth Playground (https://developers.google.com/oauthplayground):
   - Click the **gear icon** (top right) → check **"Use your own OAuth credentials"** → paste in the Client ID and Client secret from step 4 → close.
   - In the left panel, under "Step 1", find and select these two scopes (or paste them into the "Input your own scopes" box):
     `https://www.googleapis.com/auth/spreadsheets`
     `https://www.googleapis.com/auth/drive`
   - Click **Authorize APIs**, sign in as `boardgames@meepledesign.com`, accept.
   - In "Step 2", click **Exchange authorization code for tokens**.
   - Copy the **Refresh token** shown:
     - **`GOOGLE_OAUTH_REFRESH_TOKEN`**
6. In your own Google Drive, create a folder called e.g. **"Royalty Reports"**. This is the root folder everything gets organized under.
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
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `ROYALTY_ROOT_FOLDER_ID`
