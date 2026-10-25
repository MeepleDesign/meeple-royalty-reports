import { google } from "googleapis";

/**
 * OAuth (authorizing as your own Google account), not a service account —
 * your Cloud org's "secure by default" policy blocks service-account key
 * creation, and this sidesteps it entirely. As a side effect, the Drive
 * root folder is just a folder you already own; no sharing step needed.
 *
 * Two separate refresh tokens (one per API) rather than one covering both
 * scopes — that's what reliably came out of the OAuth Playground, and a
 * single-scope token works exactly as well for its own API.
 */
function buildClient(refreshToken: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET env vars");
  }
  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function getDriveClient() {
  const refreshToken = process.env.GOOGLE_OAUTH_DRIVE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("Missing GOOGLE_OAUTH_DRIVE_REFRESH_TOKEN env var");
  return google.drive({ version: "v3", auth: buildClient(refreshToken) });
}

export function getSheetsClient() {
  const refreshToken = process.env.GOOGLE_OAUTH_SHEETS_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("Missing GOOGLE_OAUTH_SHEETS_REFRESH_TOKEN env var");
  return google.sheets({ version: "v4", auth: buildClient(refreshToken) });
}
