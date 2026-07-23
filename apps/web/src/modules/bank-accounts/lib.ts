import "server-only";
import { db } from "@/lib/supabase";

export type BankAccountStatus = "pending" | "active" | "suspended" | "closed" | "rejected";

export type BankAccount = {
  id: string;
  merchant_id: string;
  country_id: string | null;
  owner_id: string | null;
  company_id: string;
  bank_id: string;
  branch_address: string | null;
  account_no: string;
  account_limit: number | null;
  email: string | null;
  sim_number: string | null;
  login_id: string | null;
  password: string | null;
  extra: Record<string, string>;
  channels: Record<string, { enabled: boolean; value?: string }>;
  status: BankAccountStatus;
  condition: string;
  reject_reason: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type BankAccountRow = BankAccount & {
  company: { name: string } | null;
  bank: { name: string; code: string | null } | null;
  owner: { full_name: string | null } | null;
  merchant: { name: string } | null;
  country: { flag: string | null; name: string } | null;
};

export const BANK_ACCOUNT_SELECT =
  "*, company:companies(name), bank:banks(name, code), owner:owners(full_name), merchant:merchants(name), country:countries(flag, name)";

export async function bankAccounts(opts: {
  merchantId?: string;
  countryId?: string;
  status?: string;
}): Promise<BankAccountRow[]> {
  let q = db().from("bank_accounts").select(BANK_ACCOUNT_SELECT).order("created_at", { ascending: false });
  if (opts.merchantId) q = q.eq("merchant_id", opts.merchantId);
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data ?? []) as unknown as BankAccountRow[];
}

export const STATUS_COLORS: Record<BankAccountStatus, string> = {
  pending: "text-warning border-warning/40 bg-warning/10",
  active: "text-success border-success/40 bg-success/10",
  suspended: "text-warning border-warning/40 bg-warning/10",
  closed: "text-muted border-border bg-surface-raised",
  rejected: "text-danger border-danger/40 bg-danger/10",
};
