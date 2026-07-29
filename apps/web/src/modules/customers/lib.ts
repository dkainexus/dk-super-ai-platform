import "server-only";
import { db } from "@/lib/supabase";

export type Customer = {
  id: string;
  ref: string | null;
  merchant_id: string;
  country_id: string | null;
  user_id: string | null;
  name: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  belongs_to: "platform" | "white_label";
  deposit: number;
  status: "active" | "suspended";
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type CustomerRow = Customer & {
  merchant: { name: string } | null;
  user: { username: string } | null;
  contracts: { count: number }[];
};

export const CUSTOMER_SELECT =
  "*, merchant:merchants(name), user:users!customers_user_id_fkey(username), contracts(count)";

export async function customers(opts: {
  countryId?: string;
  merchantId?: string;
  status?: string;
  belongsTo?: string;
}): Promise<CustomerRow[]> {
  let q = db().from("customers").select(CUSTOMER_SELECT).order("created_at", { ascending: false });
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  if (opts.merchantId) q = q.eq("merchant_id", opts.merchantId);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.belongsTo) q = q.eq("belongs_to", opts.belongsTo);
  const { data } = await q;
  return (data ?? []) as unknown as CustomerRow[];
}

export async function customer(id: string): Promise<CustomerRow | null> {
  const { data } = await db().from("customers").select(CUSTOMER_SELECT).eq("id", id).maybeSingle();
  return (data ?? null) as unknown as CustomerRow | null;
}

/** The customer record tied to a signed-in user, if any — the portal's key. */
export async function customerForUser(userId: string): Promise<Customer | null> {
  const { data } = await db().from("customers").select("*").eq("user_id", userId).maybeSingle();
  return (data ?? null) as Customer | null;
}
