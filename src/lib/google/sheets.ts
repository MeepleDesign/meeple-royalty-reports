import type { sheets_v4 } from "googleapis";

export async function createSpreadsheetWithTabs(
  sheets: sheets_v4.Sheets,
  title: string,
  tabTitles: string[]
): Promise<string> {
  const { data } = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: tabTitles.map((t) => ({ properties: { title: t } })),
    },
  });
  if (!data.spreadsheetId) throw new Error("Failed to create spreadsheet");
  return data.spreadsheetId;
}

export async function writeValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabTitle: string,
  rows: (string | number)[][]
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}

export function spreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
