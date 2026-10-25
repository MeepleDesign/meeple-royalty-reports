import type { drive_v3 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateFolder } from "./drive";

/**
 * Ensures Root -> Publisher -> Year -> Quarter exists in Drive, caching
 * folder IDs in publisher_drive_folders so repeat calls (e.g. pre-creating
 * next quarter's folder on finalize) don't re-hit the Drive API.
 */
export async function ensurePublisherQuarterFolder(
  drive: drive_v3.Drive,
  supabase: SupabaseClient,
  publisherId: string,
  publisherName: string,
  year: number,
  quarter: number
): Promise<string> {
  const rootId = process.env.ROYALTY_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("Missing ROYALTY_ROOT_FOLDER_ID env var");

  // Publisher-level folder, cached on the publishers row itself.
  let publisherFolderId: string | null = null;
  const { data: publisherRow } = await supabase
    .from("publishers")
    .select("drive_folder_id")
    .eq("id", publisherId)
    .single();
  publisherFolderId = publisherRow?.drive_folder_id ?? null;

  if (!publisherFolderId) {
    publisherFolderId = await findOrCreateFolder(drive, rootId, publisherName);
    await supabase.from("publishers").update({ drive_folder_id: publisherFolderId }).eq("id", publisherId);
  }

  const yearFolderId = await getCachedFolder(drive, supabase, publisherId, year, null, publisherFolderId, String(year));
  return getCachedFolder(drive, supabase, publisherId, year, quarter, yearFolderId, `Q${quarter}`);
}

async function getCachedFolder(
  drive: drive_v3.Drive,
  supabase: SupabaseClient,
  publisherId: string,
  year: number,
  quarter: number | null,
  parentFolderId: string,
  name: string
): Promise<string> {
  let query = supabase
    .from("publisher_drive_folders")
    .select("folder_id")
    .eq("publisher_id", publisherId)
    .eq("year", year);
  query = quarter === null ? query.is("quarter", null) : query.eq("quarter", quarter);

  const { data: cached } = await query.maybeSingle();
  if (cached?.folder_id) return cached.folder_id;

  const folderId = await findOrCreateFolder(drive, parentFolderId, name);
  // Plain insert, not upsert: Postgres' unique constraint never treats two
  // NULL `quarter` values (the year-level row) as conflicting, so onConflict
  // would silently do nothing for those rows. The lookup above already
  // confirmed no cached row exists.
  await supabase
    .from("publisher_drive_folders")
    .insert({ publisher_id: publisherId, year, quarter, folder_id: folderId });
  return folderId;
}
