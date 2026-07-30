import "server-only";
import { db } from "@/lib/supabase";
import { money, settleAccount } from "./engine";

// The white label's monthly statement, computed from what the run actually
// billed. Everything settles on their asking price — what we really charged
// the customer never enters, and neither does our markup.

export type SettlementAccountRow = {
  bank_account_id: string;
  label: string;
  own_use: boolean;
  asking_price: number | null;
  fraction: number;
  customer_billed: number;
  owner_paid: number;
  agent_paid: number;
  asking_revenue: number;
  profit: number;
  we_take: number;
  wl_takes: number;
  warning: string | null;
};

export type SettlementStatement = {
  merchant_id: string;
  merchant_name: string;
  accounts: SettlementAccountRow[];
  setup_fees: number;
  setup_we_take: number;
  setup_wl_takes: number;
  compensation_chargebacks: number;
  wl_net: number;
  we_net: number;
};

/**
 * One white label, one country, one month. Built from the issued invoices of
 * that month: the split runs per account on the asking price, setup fees split
 * at the same share, and compensation we paid to *their* customers that month
 * comes off their side — their customer, their loss.
 */
export async function computeSettlements(countryId: string, periodMonth: string): Promise<SettlementStatement[]> {
  const monthEnd = `${periodMonth.slice(0, 8)}31`;

  const { data: merchants } = await db()
    .from("merchants")
    .select("id, name, profit_share_pct, own_use_fee, merchant_countries!inner(country_id)")
    .eq("merchant_countries.country_id", countryId);

  const { data: lineRows } = await db()
    .from("invoice_lines")
    .select(
      "amount, kind, days, days_in_month, contract_account_id, invoice:invoices!inner(status, direction, party_type, merchant_id, period_month, country_id)"
    )
    .eq("invoice.period_month", periodMonth)
    .eq("invoice.country_id", countryId)
    .in("invoice.status", ["issued", "paid"]);

  type Line = {
    amount: number;
    kind: string;
    days: number | null;
    days_in_month: number | null;
    contract_account_id: string | null;
    invoice: { direction: string; party_type: string; merchant_id: string };
  };
  const lines = (lineRows ?? []) as unknown as Line[];

  // Resolve contract lines to their bank accounts and settlement fields.
  const lineIds = [...new Set(lines.map((l) => l.contract_account_id).filter((v): v is string => Boolean(v)))];
  const { data: caRows } = lineIds.length
    ? await db()
        .from("contract_accounts")
        .select("id, bank_account:bank_accounts(id, account_no, asking_price, own_use, merchant_id, bank:banks(name))")
        .in("id", lineIds)
    : { data: [] };
  const accountByLine = new Map(
    ((caRows ?? []) as unknown as {
      id: string;
      bank_account: {
        id: string; account_no: string; asking_price: number | null; own_use: boolean; merchant_id: string;
        bank: { name: string } | null;
      } | null;
    }[]).map((r) => [r.id, r.bank_account])
  );

  // Compensation paid this month to white-label-owned customers.
  const { data: compRows } = await db()
    .from("ledger_entries")
    .select("amount, holder_id, merchant_id, note, created_at, customer:customers!inner(belongs_to)")
    .eq("holder_type", "customer")
    .eq("kind", "adjustment")
    .eq("country_id", countryId)
    .ilike("note", "Theft compensation%")
    .gte("created_at", periodMonth)
    .lte("created_at", `${monthEnd}T23:59:59`);
  const chargebackByMerchant = new Map<string, number>();
  for (const e of (compRows ?? []) as unknown as {
    amount: number; merchant_id: string | null; customer: { belongs_to: string };
  }[]) {
    if (e.customer.belongs_to !== "white_label" || !e.merchant_id) continue;
    chargebackByMerchant.set(e.merchant_id, (chargebackByMerchant.get(e.merchant_id) ?? 0) + Number(e.amount));
  }

  const statements: SettlementStatement[] = [];
  for (const m of (merchants ?? []) as unknown as {
    id: string; name: string; profit_share_pct: number; own_use_fee: number;
  }[]) {
    // Group this merchant's lines per bank account.
    type Acc = {
      label: string; own_use: boolean; asking_price: number | null;
      fraction: number; customer_billed: number; owner_paid: number; agent_paid: number;
    };
    const perAccount = new Map<string, Acc>();
    let setupFees = 0;

    for (const l of lines) {
      if (l.invoice.merchant_id !== m.id) continue;
      if (l.kind === "setup_fee" && l.invoice.party_type === "customer") {
        setupFees += Number(l.amount);
        continue;
      }
      if (!l.contract_account_id) continue;
      const acc = accountByLine.get(l.contract_account_id);
      if (!acc) continue;
      const cur = perAccount.get(acc.id) ?? {
        label: `${acc.bank?.name ?? "?"} ${acc.account_no}`,
        own_use: acc.own_use,
        asking_price: acc.asking_price == null ? null : Number(acc.asking_price),
        fraction: 0,
        customer_billed: 0,
        owner_paid: 0,
        agent_paid: 0,
      };
      if (l.invoice.party_type === "customer") {
        cur.customer_billed += Number(l.amount);
        // Every base line adds its own slice: a stub plus a full month means
        // the invoice covers more than one month of asking price.
        if (l.kind === "base_rent" && l.days != null && l.days_in_month != null) {
          cur.fraction += l.days / l.days_in_month;
        }
      }
      if (l.invoice.party_type === "owner") cur.owner_paid += Number(l.amount);
      if (l.invoice.party_type === "agent") cur.agent_paid += Number(l.amount);
      perAccount.set(acc.id, cur);
    }

    if (perAccount.size === 0 && setupFees === 0 && !chargebackByMerchant.has(m.id)) continue;

    const accounts: SettlementAccountRow[] = [];
    for (const [accountId, a] of perAccount) {
      const missingPrice = !a.own_use && (a.asking_price == null || a.asking_price <= 0);
      const line = missingPrice
        ? { asking_revenue: 0, profit: 0, we_take: 0, wl_takes: 0 }
        : settleAccount(
            {
              askingPrice: a.asking_price ?? 0,
              // An account with only payouts this month (owner/agent stubs
              // before the customer starts) still settles on a full month? No —
              // with no customer billing there is nothing to settle against,
              // so the fraction stays 0 and the loss shows plainly.
              fraction: a.fraction,
              ownerPaid: a.owner_paid,
              agentPaid: a.agent_paid,
              ownUse: a.own_use,
            },
            Number(m.profit_share_pct),
            Number(m.own_use_fee)
          );
      accounts.push({
        bank_account_id: accountId,
        label: a.label,
        own_use: a.own_use,
        asking_price: a.asking_price,
        fraction: Math.round(a.fraction * 1000) / 1000,
        customer_billed: money(a.customer_billed),
        owner_paid: money(a.owner_paid),
        agent_paid: money(a.agent_paid),
        ...line,
        warning: missingPrice ? "No asking price set on the account" : null,
      });
    }

    const share = Number(m.profit_share_pct) / 100;
    const setupWe = money(setupFees * share);
    const chargeback = money(chargebackByMerchant.get(m.id) ?? 0);
    const wlNet = money(
      accounts.reduce((s, a) => s + a.wl_takes, 0) + (setupFees - setupWe) - chargeback
    );
    statements.push({
      merchant_id: m.id,
      merchant_name: m.name,
      accounts: accounts.sort((x, y) => x.label.localeCompare(y.label)),
      setup_fees: money(setupFees),
      setup_we_take: setupWe,
      setup_wl_takes: money(setupFees - setupWe),
      compensation_chargebacks: chargeback,
      wl_net: wlNet,
      we_net: money(accounts.reduce((s, a) => s + a.we_take, 0) + setupWe + chargeback),
    });
  }
  return statements.sort((a, b) => a.merchant_name.localeCompare(b.merchant_name));
}
