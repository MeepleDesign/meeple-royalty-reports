import type { drive_v3 } from "googleapis";

/** Finds an existing child folder by exact name under `parentId`, or creates one. */
export async function findOrCreateFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<string> {
  const escapedName = name.replace(/'/g, "\\'");
  const { data } = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const existing = data.files?.[0];
  if (existing?.id) return existing.id;

  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  if (!created.id) throw new Error(`Failed to create Drive folder "${name}"`);
  return created.id;
}

/** Moves a file into `folderId`, removing it from whatever parent it currently has. */
export async function moveFileToFolder(
  drive: drive_v3.Drive,
  fileId: string,
  folderId: string
): Promise<void> {
  const { data } = await drive.files.get({ fileId, fields: "parents" });
  const previousParents = (data.parents ?? []).join(",");
  await drive.files.update({
    fileId,
    addParents: folderId,
    removeParents: previousParents || undefined,
    fields: "id, parents",
  });
}
