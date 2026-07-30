// The worked examples from docs/billing-spec.md §4, as tests. If the billing
// arithmetic ever changes, this fails loudly instead of quietly.
//
//   node --experimental-strip-types src/modules/billing/engine.test.mjs
//
// Run through `npm test` in apps/web.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  addMonths,
  dayCount,
  daysInMonth,
  linesForAccount,
  rentForMonth,
  rentRefund,
  setupFeeRefund,
  termStart,
  termsOn,
} from "./engine.ts";

// The account from the spec: Kasikornbank ···1234, active 10 March 2026.
const CUSTOMER_RENT = 130_000;
const OWNER_RENT = 30_000;
const AGENT_RENT = 10_000;
const SETUP_FEE = 20_000;

const line = (id, startsOn, baseRent, opts = {}) => ({
  contract_account_id: id,
  starts_on: startsOn,
  ends_on: opts.ends_on ?? null,
  setup_fee: opts.setup_fee ?? 0,
  setup_fee_invoiced: opts.setup_fee_invoiced ?? false,
  terms: opts.terms ?? [
    { base_rent: baseRent, turnover_rate: opts.rate ?? null, effective_from: startsOn, effective_to: null },
  ],
});

test("dates behave", () => {
  assert.equal(dayCount("2026-03-21", "2026-03-31"), 11, "21–31 March is 11 days");
  assert.equal(dayCount("2026-04-03", "2026-04-30"), 28, "3–30 April is 28 days");
  assert.equal(dayCount("2026-03-24", "2026-03-31"), 8);
  assert.equal(daysInMonth(2026, 3), 31);
  assert.equal(daysInMonth(2026, 4), 30);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2024, 2), 29, "leap year");
  assert.equal(addMonths("2026-03-31", 1), "2026-04-30", "clamps to the shorter month");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("the term starts on the 1st of the month after the account does", () => {
  assert.equal(termStart("2026-03-21"), "2026-04-01");
  assert.equal(termStart("2026-04-03"), "2026-05-01");
  assert.equal(termStart("2026-04-01"), "2026-05-01");
});

test("terms are read as of a day, and a new version supersedes the old", () => {
  const terms = [
    { base_rent: 100_000, turnover_rate: null, effective_from: "2026-01-01", effective_to: "2026-03-31" },
    { base_rent: 130_000, turnover_rate: 0.3, effective_from: "2026-04-01", effective_to: null },
  ];
  assert.equal(termsOn(terms, "2026-03-15").base_rent, 100_000);
  assert.equal(termsOn(terms, "2026-04-01").base_rent, 130_000);
  assert.equal(termsOn(terms, "2025-12-31"), null, "nothing applies before the first version");
});

// ---------------------------------------------------------------- example A

test("§4 example A — customer confirms on the day, starts 21 March", () => {
  const customer = line("ca-cust", "2026-03-21", CUSTOMER_RENT, { setup_fee: SETUP_FEE, rate: 0.3 });

  // The stub itself
  const stub = rentForMonth(customer, "2026-03-01");
  assert.equal(stub.days, 11);
  assert.equal(stub.inMonth, 31);
  assert.equal(stub.amount, 46_129.03, "130,000 × 11/31");

  // The 1 April run raises: setup fee, the March stub, and April in full.
  const april = linesForAccount(customer, "2026-04-01");
  assert.deepEqual(
    april.map((l) => [l.kind, l.amount]),
    [
      ["setup_fee", 20_000],
      ["base_rent", 46_129.03],
      ["base_rent", 130_000],
    ]
  );
  assert.equal(
    april.reduce((s, l) => s + l.amount, 0),
    196_129.03,
    "the invoice total in the spec"
  );

  // The March run raises nothing: the month has not closed, so the stub waits.
  assert.deepEqual(linesForAccount(customer, "2026-03-01"), []);
});

test("§4 example A — owner and agent start 24 March and are billed in April", () => {
  const owner = line("ca-own", "2026-03-24", OWNER_RENT);
  const agent = line("ca-agt", "2026-03-24", AGENT_RENT, { rate: 0.05 });

  const ownerApril = linesForAccount(owner, "2026-04-01");
  assert.deepEqual(ownerApril.map((l) => l.amount), [7_741.94, 30_000], "30,000 × 8/31, then April");

  const agentApril = linesForAccount(agent, "2026-04-01");
  assert.deepEqual(agentApril.map((l) => l.amount), [2_580.65, 10_000], "10,000 × 8/31, then April");
});

// ---------------------------------------------------------------- example B

test("§4 example B — posted, so the customer starts 3 April", () => {
  const customer = line("ca-cust-b", "2026-04-03", CUSTOMER_RENT, { setup_fee: SETUP_FEE, rate: 0.3 });

  // April's run raises nothing — the account only starts mid-April.
  assert.deepEqual(linesForAccount(customer, "2026-04-01"), []);

  // May's run raises the April stub and May in full.
  const may = linesForAccount(customer, "2026-05-01");
  assert.deepEqual(
    may.map((l) => [l.kind, l.amount]),
    [
      ["setup_fee", 20_000],
      ["base_rent", 121_333.33],
      ["base_rent", 130_000],
    ],
    "130,000 × 28/30 for 3–30 April"
  );
});

test("§4 example B — owner and agent are unaffected by the customer's delay", () => {
  const owner = line("ca-own-b", "2026-03-24", OWNER_RENT);
  const april = linesForAccount(owner, "2026-04-01");
  assert.deepEqual(april.map((l) => l.amount), [7_741.94, 30_000]);
});

// ---------------------------------------------------------------- the rules

test("a run can be repeated without billing twice", () => {
  const customer = line("ca-idem", "2026-03-21", CUSTOMER_RENT, { setup_fee: SETUP_FEE });
  const first = linesForAccount(customer, "2026-04-01");
  const again = linesForAccount(customer, "2026-04-01");
  assert.deepEqual(
    first.map((l) => l.dedupe_key),
    again.map((l) => l.dedupe_key),
    "the same keys, so the unique index rejects the repeat"
  );
  assert.equal(new Set(first.map((l) => l.dedupe_key)).size, first.length, "keys are unique within a run");
});

test("the setup fee is charged once", () => {
  const paid = line("ca-setup", "2026-03-21", CUSTOMER_RENT, { setup_fee: SETUP_FEE, setup_fee_invoiced: true });
  const lines = linesForAccount(paid, "2026-04-01");
  assert.ok(!lines.some((l) => l.kind === "setup_fee"), "already invoiced, so not again");
});

test("a whole month is the base rent, never prorated", () => {
  const customer = line("ca-full", "2026-03-01", CUSTOMER_RENT);
  const march = rentForMonth(customer, "2026-03-01");
  assert.equal(march.days, 31);
  assert.equal(march.amount, CUSTOMER_RENT, "not 130,000 × 31/31 with rounding drift");
});

test("an account that ends mid-month is prorated to its last day", () => {
  const customer = line("ca-end", "2026-01-01", CUSTOMER_RENT, { ends_on: "2026-04-10" });
  const april = rentForMonth(customer, "2026-04-01");
  assert.equal(april.days, 10);
  assert.equal(april.amount, 43_333.33, "130,000 × 10/30");
  assert.equal(rentForMonth(customer, "2026-05-01"), null, "nothing after it ends");
});

test("a price change applies from the month it takes effect, and history stands", () => {
  const customer = line("ca-change", "2026-01-01", 0, {
    terms: [
      { base_rent: 100_000, turnover_rate: null, effective_from: "2026-01-01", effective_to: "2026-03-31" },
      { base_rent: 130_000, turnover_rate: null, effective_from: "2026-04-01", effective_to: null },
    ],
  });
  assert.equal(rentForMonth(customer, "2026-03-01").amount, 100_000);
  assert.equal(rentForMonth(customer, "2026-04-01").amount, 130_000);
});

test("§8 refunds — setup fee amortises over 30 days, rent over the month", () => {
  assert.equal(setupFeeRefund(SETUP_FEE, "2026-03-01", "2026-03-10"), 13_333.33, "10 days used of 30");
  assert.equal(setupFeeRefund(SETUP_FEE, "2026-03-01", "2026-03-29"), 666.67, "29 days used, one left");
  assert.equal(setupFeeRefund(SETUP_FEE, "2026-03-01", "2026-03-30"), 0, "30 days used, fully amortised");
  assert.equal(setupFeeRefund(SETUP_FEE, "2026-03-01", "2026-04-15"), 0, "past 30 days, nothing back");

  assert.equal(rentRefund(CUSTOMER_RENT, "2026-04-10", "2026-04-30"), 86_666.67, "20 unused days of 30");
  assert.equal(rentRefund(CUSTOMER_RENT, "2026-04-30", "2026-04-30"), 0, "used the whole month");
});

test("§4 turnover top-ups — the base is a floor, turnover only adds", async () => {
  const { turnoverTopup } = await import("./engine.ts");
  const customer = line("ca-t", "2026-03-21", CUSTOMER_RENT, { rate: 0.3 });

  // March stub: 12M × 0.30% = 36,000 < 46,129.03 billed → nothing.
  assert.equal(turnoverTopup(customer, "2026-03-01", 12_000_000), null);

  // April: 50M × 0.30% = 150,000 against 130,000 billed → 20,000.
  const april = turnoverTopup(customer, "2026-04-01", 50_000_000);
  assert.equal(april.amount, 20_000);
  assert.equal(april.kind, "turnover_topup");

  // The agent's own 0.05% on the same turnover: 25,000 against 10,000 → 15,000.
  const agent = line("ca-t-agt", "2026-03-24", AGENT_RENT, { rate: 0.05 });
  assert.equal(turnoverTopup(agent, "2026-04-01", 50_000_000).amount, 15_000);

  // No rate on the line → never a top-up, whatever the turnover.
  const flat = line("ca-t-flat", "2026-03-24", OWNER_RENT);
  assert.equal(turnoverTopup(flat, "2026-04-01", 999_000_000), null);

  // Same inputs, same key — a rerun cannot raise it twice.
  assert.equal(april.dedupe_key, turnoverTopup(customer, "2026-04-01", 50_000_000).dedupe_key);
});

test("§8 — the worked theft example", async () => {
  const { computeClaim } = await import("./engine.ts");
  // Owner takes 500,000. Customer deposit 100,000, agent deposit 200,000,
  // window 6 months, company registered 2 months before the claim.
  const c = computeClaim({
    stolen: 500_000,
    customerDeposit: 100_000,
    agentDeposit: 200_000,
    agentWindowMonths: 6,
    companyRegisteredOn: "2026-05-29",
    claimedOn: "2026-07-29",
    companyContribution: 30_000,
    rentPaidBase: 37_741.94, // owner 30,000 + stub 7,741.94
    rentPaidTurnover: 15_000, // the agent's April top-up, owed whole
    setupFee: 20_000,
    customerStartedOn: "2026-07-10",
  });
  assert.equal(c.customer_compensation, 100_000, "capped at the customer's own deposit");
  assert.equal(c.written_off, 400_000, "the shortfall is written off, not carried");
  assert.equal(c.inside_agent_window, true);
  assert.equal(c.agent_deposit_due, 200_000, "capped at the agent's own deposit");
  assert.equal(c.agent_company_due, 30_000);
  assert.equal(c.agent_rent_due, 52_741.94, "base prorated as billed; turnover whole");
  assert.equal(c.agent_total_due, 282_741.94);
  assert.equal(c.customer_setup_fee_refund, 6_666.67, "19 days used of 30 → 11 back");
});

test("§8 — outside the window only the deposit comes back", async () => {
  const { computeClaim } = await import("./engine.ts");
  const c = computeClaim({
    stolen: 500_000,
    customerDeposit: 100_000,
    agentDeposit: 200_000,
    agentWindowMonths: 6,
    companyRegisteredOn: "2025-01-01",
    claimedOn: "2026-07-29",
    companyContribution: 30_000,
    rentPaidBase: 999_999,
    rentPaidTurnover: 999_999,
    setupFee: 20_000,
    customerStartedOn: "2025-02-01",
  });
  assert.equal(c.inside_agent_window, false);
  assert.equal(c.agent_total_due, 200_000);
  assert.equal(c.customer_setup_fee_refund, 0, "past 30 days, nothing back");
});

test("§5 — the four-way split settles on the asking price", async () => {
  const { settleAccount } = await import("./engine.ts");
  const line = settleAccount(
    { askingPrice: 80_000, days: 30, daysInMonth: 30, ownerPaid: 30_000, agentPaid: 10_000, ownUse: false },
    50,
    0
  );
  assert.equal(line.profit, 40_000);
  assert.equal(line.we_take, 20_000);
  assert.equal(line.wl_takes, 20_000);

  // A part month settles on the same fraction the customer was billed.
  const stub = settleAccount(
    { askingPrice: 80_000, days: 11, daysInMonth: 31, ownerPaid: 7_741.94, agentPaid: 2_580.65, ownUse: false },
    50,
    0
  );
  assert.equal(stub.asking_revenue, 28_387.1);
  assert.equal(stub.profit, 18_064.51);
  assert.equal(stub.we_take, 9_032.25, "half of the profit, rounded to cents");
  assert.equal(stub.wl_takes, 9_032.26, "the other half carries the rounding cent");
  assert.ok(Math.abs(stub.we_take + stub.wl_takes - stub.profit) < 0.005, "the split never loses a cent");

  // Own use: the flat fee, nothing else.
  const own = settleAccount(
    { askingPrice: 80_000, days: 30, daysInMonth: 30, ownerPaid: 30_000, agentPaid: 0, ownUse: true },
    50,
    15_000
  );
  assert.equal(own.we_take, 15_000);
  assert.equal(own.wl_takes, -15_000);
});
