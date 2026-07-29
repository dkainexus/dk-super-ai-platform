// The arithmetic of a monthly billing run, with no database in sight so it can
// be tested directly. See docs/billing-spec.md §3 and §4 — the worked examples
// there are the test cases in engine.test.ts.

export type Terms = {
  /** Rent for a whole month, in the country's currency. */
  base_rent: number;
  /** Percent of turnover, e.g. 0.3 means 0.30%. Null = no turnover component. */
  turnover_rate: number | null;
  effective_from: string;
  effective_to: string | null;
};

export type AccountLine = {
  contract_account_id: string;
  /** The day billing starts for this account. */
  starts_on: string;
  /** The day it stops, if it has. */
  ends_on: string | null;
  setup_fee: number;
  setup_fee_invoiced: boolean;
  /** Every version, in any order. */
  terms: Terms[];
};

export type BilledLine = {
  contract_account_id: string;
  kind: "base_rent" | "setup_fee";
  description: string;
  period_start: string | null;
  period_end: string | null;
  days: number | null;
  days_in_month: number | null;
  amount: number;
  /** One line per thing per period, so a repeated run adds nothing. */
  dedupe_key: string;
  snapshot: Record<string, unknown>;
};

// ---------- dates ----------

/** A date as YYYY-MM-DD, with no timezone anywhere near it. */
export const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export const parse = (s: string): { y: number; m: number; d: number } => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
};

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const firstOfMonth = (s: string) => {
  const { y, m } = parse(s);
  return iso(y, m, 1);
};

export const lastOfMonth = (s: string) => {
  const { y, m } = parse(s);
  return iso(y, m, daysInMonth(y, m));
};

export const addMonths = (s: string, n: number) => {
  const { y, m, d } = parse(s);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return iso(ny, nm, Math.min(d, daysInMonth(ny, nm)));
};

export const addDays = (s: string, n: number) => {
  const { y, m, d } = parse(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};

/** Inclusive day count: 21–31 March is 11 days. */
export const dayCount = (from: string, to: string) => {
  const a = parse(from);
  const b = parse(to);
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86400000) + 1;
};

const laterOf = (a: string, b: string) => (a > b ? a : b);
const earlierOf = (a: string, b: string) => (a < b ? a : b);

/** Money is rounded to cents once, at the point it becomes an amount. */
export const money = (n: number) => Math.round(n * 100) / 100;

// ---------- terms ----------

/** The version of the terms that applies on a given day. */
export function termsOn(terms: Terms[], day: string): Terms | null {
  const live = terms
    .filter((t) => t.effective_from <= day && (!t.effective_to || t.effective_to >= day))
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  return live[0] ?? null;
}

// ---------- the run ----------

/**
 * What a period start means for the term: the contract runs from the 1st of the
 * month after the account starts, so a mid-month start leaves a stub that is
 * billed on its own.
 */
export function termStart(accountStart: string): string {
  return firstOfMonth(addMonths(accountStart, 1));
}

/**
 * Rent for one account in one month. A whole month is the base; a partial month
 * is prorated by days. Returns null when the account was not live at all.
 */
export function rentForMonth(
  line: AccountLine,
  periodMonth: string
): { start: string; end: string; days: number; inMonth: number; amount: number; terms: Terms } | null {
  const monthStart = firstOfMonth(periodMonth);
  const monthEnd = lastOfMonth(periodMonth);

  const start = laterOf(monthStart, line.starts_on);
  const end = line.ends_on ? earlierOf(monthEnd, line.ends_on) : monthEnd;
  if (start > end) return null;

  const terms = termsOn(line.terms, start);
  if (!terms) return null;

  const inMonth = dayCount(monthStart, monthEnd);
  const days = dayCount(start, end);
  const whole = days === inMonth;
  return {
    start,
    end,
    days,
    inMonth,
    terms,
    amount: money(whole ? terms.base_rent : (terms.base_rent * days) / inMonth),
  };
}

/**
 * The lines a run raises for one account in one month:
 *
 *  - the stub left by a mid-month start, billed once the month it fell in is over
 *  - this month's rent, billed in advance
 *  - the one-off setup fee, the first time the account is billed at all
 *
 * `periodMonth` is the month being run — the 1st of it.
 */
export function linesForAccount(line: AccountLine, periodMonth: string): BilledLine[] {
  const out: BilledLine[] = [];
  const month = firstOfMonth(periodMonth);
  const previous = firstOfMonth(addMonths(month, -1));

  // The stub from the previous month, now that the month has closed.
  const stubMonth = firstOfMonth(line.starts_on);
  if (stubMonth === previous) {
    const stub = rentForMonth(line, previous);
    // Only a genuinely partial month is a stub; a full month was billed in advance.
    if (stub && stub.days < stub.inMonth) {
      out.push({
        contract_account_id: line.contract_account_id,
        kind: "base_rent",
        description: `Rent ${stub.start} to ${stub.end} (${stub.days} of ${stub.inMonth} days)`,
        period_start: stub.start,
        period_end: stub.end,
        days: stub.days,
        days_in_month: stub.inMonth,
        amount: stub.amount,
        dedupe_key: `base|${line.contract_account_id}|${previous}`,
        snapshot: {
          base_rent: stub.terms.base_rent,
          turnover_rate: stub.terms.turnover_rate,
          prorated: true,
        },
      });
    }
  }

  // This month, in advance — unless the account only starts later this month,
  // in which case it is a stub and waits for the month to close.
  const now = rentForMonth(line, month);
  if (now && now.days === now.inMonth) {
    out.push({
      contract_account_id: line.contract_account_id,
      kind: "base_rent",
      description: `Rent ${month} to ${now.end}`,
      period_start: now.start,
      period_end: now.end,
      days: now.days,
      days_in_month: now.inMonth,
      amount: now.amount,
      dedupe_key: `base|${line.contract_account_id}|${month}`,
      snapshot: {
        base_rent: now.terms.base_rent,
        turnover_rate: now.terms.turnover_rate,
        prorated: false,
      },
    });
  }

  // The setup fee rides on the first invoice this account ever appears on.
  if (line.setup_fee > 0 && !line.setup_fee_invoiced && out.length > 0) {
    out.unshift({
      contract_account_id: line.contract_account_id,
      kind: "setup_fee",
      description: "Setup fee",
      period_start: null,
      period_end: null,
      days: null,
      days_in_month: null,
      amount: money(line.setup_fee),
      dedupe_key: `setup|${line.contract_account_id}`,
      snapshot: { setup_fee: line.setup_fee },
    });
  }

  return out;
}

/**
 * Refund of a setup fee when an account dies young: amortised over 30 days from
 * the day it started, nothing left after that.
 */
export function setupFeeRefund(setupFee: number, startedOn: string, endedOn: string): number {
  const used = dayCount(startedOn, endedOn);
  if (used >= 30) return 0;
  return money((setupFee * (30 - used)) / 30);
}

/** Refund of rent already billed for days the account will not be used. */
export function rentRefund(baseRent: number, endedOn: string, paidTo: string): number {
  if (endedOn >= paidTo) return 0;
  const unused = dayCount(addDays(endedOn, 1), paidTo);
  const inMonth = dayCount(firstOfMonth(paidTo), lastOfMonth(paidTo));
  return money((baseRent * unused) / inMonth);
}

// ---------- what the run tells you before you commit ----------

export type RunWarning = { level: "info" | "warn"; message: string };
