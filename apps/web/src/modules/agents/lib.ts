import "server-only";
import { db } from "@/lib/supabase";

export type Agent = {
  id: string;
  ref: string | null;
  merchant_id: string;
  country_id: string | null;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: "active" | "suspended";
  invite_token: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
};

export type AgentRow = Agent & {
  merchant: { name: string } | null;
  country: { name: string; flag: string | null } | null;
  user: { username: string } | null;
  owners: { count: number }[];
};

export const AGENT_SELECT =
  "*, merchant:merchants(name), country:countries(name, flag), user:users(username), owners(count)";

export async function agents(opts: { merchantId?: string; countryId?: string }): Promise<AgentRow[]> {
  let q = db().from("agents").select(AGENT_SELECT).order("created_at", { ascending: false });
  if (opts.merchantId) q = q.eq("merchant_id", opts.merchantId);
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  const { data } = await q;
  return (data ?? []) as unknown as AgentRow[];
}

export async function agent(id: string): Promise<AgentRow | null> {
  const { data } = await db().from("agents").select(AGENT_SELECT).eq("id", id).maybeSingle();
  return (data ?? null) as unknown as AgentRow | null;
}

/** The agent record tied to a signed-in user, if any. */
export async function agentForUser(userId: string): Promise<Agent | null> {
  const { data } = await db().from("agents").select("*").eq("user_id", userId).maybeSingle();
  return (data ?? null) as Agent | null;
}
