export function quarterDateRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3; // 0-indexed
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0); // last day of the 3rd month
  return { start: toIso(start), end: toIso(end) };
}

export function nextQuarter(year: number, quarter: number): { year: number; quarter: number } {
  return quarter === 4 ? { year: year + 1, quarter: 1 } : { year, quarter: quarter + 1 };
}

export function quarterLabel(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
