import { db } from "@/lib/supabase";
import { ownerFromRequest, unauthorized } from "@/lib/app-auth";

// GET  /api/app/bank-accounts → the owner's submitted bank accounts.
// POST /api/app/bank-accounts → submit a new account (status: pending).

export async function GET(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  const { data } = await db()
    .from("bank_accounts")
    .select("id, account_no, status, condition, reject_reason, activated_at, created_at, bank:banks(name, code), company:companies(name)")
    .eq("owner_id", owner.id)
    .order("created_at", { ascending: false });

  return Response.json({
    accounts: ((data ?? []) as unknown as {
      id: string; account_no: string; status: string; condition: string; reject_reason: string | null;
      activated_at: string | null; created_at: string;
      bank: { name: string; code: string | null } | null; company: { name: string } | null;
    }[]).map((a) => ({
      id: a.id,
      bank: a.bank?.name ?? "?",
      company: a.company?.name ?? "?",
      account_no: a.account_no,
      status: a.status,
      condition: a.condition,
      reject_reason: a.reject_reason,
      activated_at: a.activated_at,
      created_at: a.created_at,
    })),
  });
}

export async function POST(req: Request): Promise<Response> {
  const owner = await ownerFromRequest(req);
  if (!owner) return unauthorized();

  let body: {
    company_id?: string;
    bank_id?: string;
    branch_address?: string;
    account_no?: string;
    account_limit?: number;
    email?: string;
    sim_number?: string;
    login_id?: string;
    password?: string;
    extra?: Record<string, string>;
    channels?: Record<string, { enabled: boolean; value?: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.company_id) return Response.json({ error: "Please choose a company" }, { status: 400 });
  if (!body.bank_id) return Response.json({ error: "Please choose a bank" }, { status: 400 });
  if (!body.account_no?.trim()) return Response.json({ error: "Please enter the account number" }, { status: 400 });

  const [{ data: company }, { data: bank }] = await Promise.all([
    db().from("companies").select("id, merchant_id, country_id").eq("id", body.company_id).eq("merchant_id", owner.merchant_id).maybeSingle(),
    db().from("banks").select("id, account_fields, channels").eq("id", body.bank_id).eq("active", true).maybeSingle(),
  ]);
  if (!company) return Response.json({ error: "Company not found" }, { status: 400 });
  if (!bank) return Response.json({ error: "Bank not found" }, { status: 400 });

  // Keep only extras/channels the bank actually defines.
  const allowedFields = new Set(((bank.account_fields ?? []) as { key: string }[]).map((f) => f.key));
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.extra ?? {})) {
    if (allowedFields.has(k) && String(v).trim()) extra[k] = String(v).trim().slice(0, 200);
  }
  const allowedChannels = new Set((bank.channels ?? []) as string[]);
  const channels: Record<string, { enabled: boolean; value?: string }> = {};
  for (const [k, v] of Object.entries(body.channels ?? {})) {
    if (!allowedChannels.has(k)) continue;
    channels[k] = { enabled: Boolean(v?.enabled), ...(v?.value ? { value: String(v.value).slice(0, 100) } : {}) };
  }

  const { error } = await db().from("bank_accounts").insert({
    merchant_id: company.merchant_id,
    country_id: company.country_id ?? owner.country_id,
    owner_id: owner.id,
    company_id: company.id,
    bank_id: bank.id,
    branch_address: body.branch_address?.trim() || null,
    account_no: body.account_no.trim(),
    account_limit: Number.isFinite(body.account_limit) ? body.account_limit : null,
    email: body.email?.trim() || null,
    sim_number: body.sim_number?.trim() || null,
    login_id: body.login_id?.trim() || null,
    password: body.password?.trim() || null,
    extra,
    channels,
    status: "pending",
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
