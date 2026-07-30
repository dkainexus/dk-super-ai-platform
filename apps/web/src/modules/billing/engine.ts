// The arithmetic of a monthly billing run, with no database in sight so it can
// be tested directly. See docs/billing-spec.md §3 and §4 — the worked examples
// there are the test cases in engine.test.ts.

/**
 * How a party is paid:
 *  - rent: the base only; turnover never enters
 *  - turnover: a share of turnover only — no base, nothing billed in advance
 *  - rent_plus_turnover: the base in advance plus the whole turnover share
 *  - max: whichever is higher, base as the floor (the customer model)
 */
export type PayMode = "rent" | "turnover" | "rent_plus_turnover" | "max";

export type Terms = {
  /** Rent for a whole month, in the country's currency. */
  base_rent: number;
  /** Percent of turnover, e.g. 0.3 means 0.30%. Null = no turnover component. */
  turnover_rate: number | null;
  mode?: PayMode;
  effective_from: string;
  effective_to: string | null;
};

const modeOf = (t: Terms): PayMode => t.mode ?? "max";

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
  contract_account_id: string | null;
  kind: "base_rent" | "setup_fee" | "turnover_topup" | "service" | "adjustment";
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
    // Only a genuinely partial month is a stub; a full month was billed in
    // advance. Pure turnover has no base at all — nothing to bill here.
    if (stub && modeOf(stub.terms) === "turnover") {
      // fall through — no base lines for a turnover-only party
    } else if (stub && stub.days < stub.inMonth) {
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
  if (now && modeOf(now.terms) !== "turnover" && now.days === now.inMonth) {
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

// ---------- turnover ----------

/**
 * What a month's approved turnover produces, by the terms' mode:
 *
 *  - max: the higher of the base already billed and turnover × rate — the base
 *    is a floor and turnover only ever adds the difference
 *  - rent_plus_turnover: the whole turnover share on top of the base
 *  - turnover: the whole turnover share, there was no base
 *  - rent: nothing — turnover never enters
 *
 * Turnover money is never prorated: a partial month's base prorates, the
 * share of what actually flowed does not.
 *
 * `turnoverMonth` is the month the turnover belongs to — the run raising this
 * line happens the month after, once the figure is in and approved.
 */
export function turnoverTopup(
  line: AccountLine,
  turnoverMonth: string,
  turnover: number
): BilledLine | null {
  const billed = rentForMonth(line, turnoverMonth);
  if (!billed) return null;
  const mode = modeOf(billed.terms);
  if (mode === "rent") return null;
  const rate = billed.terms.turnover_rate;
  if (rate == null || rate <= 0) return null;

  const byTurnover = money((turnover * rate) / 100);
  let amount: number;
  if (mode === "max") {
    if (byTurnover <= billed.amount) return null;
    amount = money(byTurnover - billed.amount);
  } else {
    // turnover / rent_plus_turnover: the whole share, additive.
    if (byTurnover <= 0) return null;
    amount = byTurnover;
  }

  return {
    contract_account_id: line.contract_account_id,
    kind: "turnover_topup",
    description:
      mode === "max"
        ? `Turnover top-up for ${firstOfMonth(turnoverMonth).slice(0, 7)}`
        : `Turnover share for ${firstOfMonth(turnoverMonth).slice(0, 7)}`,
    period_start: billed.start,
    period_end: billed.end,
    days: billed.days,
    days_in_month: billed.inMonth,
    amount,
    dedupe_key: `topup|${line.contract_account_id}|${firstOfMonth(turnoverMonth)}`,
    snapshot: {
      turnover,
      turnover_rate: rate,
      mode,
      by_turnover: byTurnover,
      base_billed: mode === "turnover" ? 0 : billed.amount,
    },
  };
}

// ---------- theft claims (§8) ----------

export type ClaimInput = {
  /** What was taken. */
  stolen: number;
  customerDeposit: number;
  agentDeposit: number;
  /** Months of agent liability, measured from the company's registration. */
  agentWindowMonths: number | null;
  /**
   * A pure-turnover agent has no contract months to bound liability — their
   * window stays open for as long as the account is in use.
   */
  agentWindowOpen?: boolean;
  companyRegisteredOn: string | null;
  claimedOn: string;
  /** What the white label put in when the company was registered. */
  companyContribution: number;
  /** Base rent already paid out to the owner and the agent for this account. */
  rentPaidBase: number;
  /** Turnover top-ups already paid out — owed whole, never prorated. */
  rentPaidTurnover: number;
  /** The customer's setup fee and when their billing started, for the refund. */
  setupFee: number;
  customerStartedOn: string | null;
};

export type ClaimComputation = {
  customer_compensation: number;
  customer_setup_fee_refund: number;
  inside_agent_window: boolean;
  agent_deposit_due: number;
  agent_company_due: number;
  agent_rent_due: number;
  agent_total_due: number;
  written_off: number;
};

/**
 * Who owes whom after a theft. Both caps are the party's own deposit; inside
 * the agent's window the company contribution and the rent already paid out
 * come back too. Anything beyond the caps is written off, not carried.
 */
export function computeClaim(input: ClaimInput): ClaimComputation {
  const compensation = money(Math.min(input.stolen, Math.max(0, input.customerDeposit)));

  // Stolen within 30 days of the customer's start → the setup fee comes back
  // prorated over those 30 days.
  const setupRefund =
    input.customerStartedOn != null
      ? setupFeeRefund(input.setupFee, input.customerStartedOn, input.claimedOn)
      : 0;

  const inside =
    input.agentWindowOpen === true ||
    (input.agentWindowMonths != null &&
      input.companyRegisteredOn != null &&
      input.claimedOn <= addMonths(input.companyRegisteredOn, input.agentWindowMonths));

  const agentDeposit = money(Math.min(input.stolen, Math.max(0, input.agentDeposit)));
  const agentCompany = inside ? money(input.companyContribution) : 0;
  const agentRent = inside ? money(input.rentPaidBase + input.rentPaidTurnover) : 0;
  const agentTotal = money(agentDeposit + agentCompany + agentRent);

  return {
    customer_compensation: compensation,
    customer_setup_fee_refund: setupRefund,
    inside_agent_window: inside,
    agent_deposit_due: agentDeposit,
    agent_company_due: agentCompany,
    agent_rent_due: agentRent,
    agent_total_due: agentTotal,
    written_off: money(Math.max(0, input.stolen - compensation)),
  };
}

// ---------- white-label settlement (§5) ----------

export type SettlementAccount = {
  /** The white label's asking price for a month of this account. */
  askingPrice: number;
  /**
   * How much billed time the invoice covers, in months: a whole month is 1, a
   * stub is its fraction, and an invoice carrying last month's stub plus this
   * month in advance exceeds 1 — the asking revenue covers both.
   */
  fraction: number;
  ownerPaid: number;
  agentPaid: number;
  ownUse: boolean;
};

export type SettlementLine = {
  asking_revenue: number;
  profit: number;
  we_take: number;
  wl_takes: number;
};

/**
 * One account, one month. We are the dividend side: profit on the asking price
 * splits at the share; an own-use account pays the flat fee instead. Whatever
 * we actually charged the customer above the asking price never enters this.
 */
export function settleAccount(a: SettlementAccount, sharePct: number, ownUseFee: number): SettlementLine {
  if (a.ownUse) {
    return { asking_revenue: 0, profit: 0, we_take: money(ownUseFee), wl_takes: money(-ownUseFee) };
  }
  const revenue = money(a.askingPrice * a.fraction);
  const profit = money(revenue - a.ownerPaid - a.agentPaid);
  // We take a dividend, never a loss: a loss-making account is entirely the
  // white label's — they set the asking price.
  const weTake = money(Math.max(0, (profit * sharePct) / 100));
  return { asking_revenue: revenue, profit, we_take: weTake, wl_takes: money(profit - weTake) };
}
