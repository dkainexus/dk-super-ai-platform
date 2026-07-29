// Shared number formatting — ALWAYS use these for money/amount display.
// Rule: any number shown to users gets thousands separators (10,000 not 10000).

export function fmtNum(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function fmtMoney(value: number | string | null | undefined, currency?: string | null): string {
  const s = fmtNum(value);
  return s === "—" || !currency ? s : `${s} ${currency}`;
}
