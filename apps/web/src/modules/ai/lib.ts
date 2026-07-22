import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/supabase";
import { getSetting } from "@/lib/settings";
import { globalModuleToggles, moduleEnabledFor, platformSettings } from "@/lib/settings";
import { can, type CurrentUser } from "@/lib/auth";
import { OWNER_STATUS_LABEL, type OwnerStatus } from "@/lib/types";

// AI Assistant module. Provider config lives in app_config under key 'ai';
// answers are generated from a data snapshot that is filtered by the current
// user's role permissions BEFORE it ever reaches the model.

export type AiProvider = "claude" | "chatgpt";

export type AiSettings = {
  provider: AiProvider;
  claude_api_key: string;
  claude_model: string;
  chatgpt_api_key: string;
  chatgpt_model: string;
};

export const CLAUDE_MODELS = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"];
export const CHATGPT_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1"];

export const AI_DEFAULTS: AiSettings = {
  provider: "claude",
  claude_api_key: "",
  claude_model: "claude-opus-4-8",
  chatgpt_api_key: "",
  chatgpt_model: "gpt-4o",
};

export async function aiSettings(): Promise<AiSettings> {
  const stored = await getSetting<Partial<AiSettings>>("ai", {});
  return { ...AI_DEFAULTS, ...stored };
}

/** Key of the currently selected provider ("" when not configured yet). */
export function activeKey(s: AiSettings): string {
  return s.provider === "claude" ? s.claude_api_key : s.chatgpt_api_key;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
}

// ---------- Role-scoped data snapshot ----------

type Row = Record<string, unknown>;
const LIMIT = 200;

/**
 * Build the data context for the signed-in user. Every dataset is included
 * only when the user's role can VIEW that module, and rows are filtered to
 * the permitted scope (own / merchant / all). This is the security boundary:
 * the model only ever sees what the user is allowed to see.
 */
export async function buildAiContext(cu: CurrentUser): Promise<string> {
  const toggles = await globalModuleToggles();
  const on = (key: string) => moduleEnabledFor(key, toggles, cu.merchant);
  const ctx: Record<string, unknown> = {};

  // Lookup maps used to translate ids into names in several datasets.
  const [{ data: countryRows }, { data: merchantRows }, { data: mcRows }] = await Promise.all([
    db().from("countries").select("id, code, name, active, sort"),
    db().from("merchants").select("id, name, subdomain, custom_domain, status, disabled_modules"),
    db().from("merchant_countries").select("merchant_id, country_id"),
  ]);
  const countryName = new Map((countryRows ?? []).map((c) => [c.id as string, c.name as string]));
  const merchantName = new Map((merchantRows ?? []).map((m) => [m.id as string, m.name as string]));
  const merchantCountryNames = new Map<string, string[]>();
  for (const r of (mcRows ?? []) as { merchant_id: string; country_id: string }[]) {
    const list = merchantCountryNames.get(r.merchant_id) ?? [];
    const n = countryName.get(r.country_id);
    if (n) list.push(n);
    merchantCountryNames.set(r.merchant_id, list);
  }

  if (!cu.merchant && can(cu, "countries", "view")) {
    ctx.countries = (countryRows ?? []).map((c) => ({ code: c.code, name: c.name, active: c.active }));
  }
  if (!cu.merchant && can(cu, "merchants", "view")) {
    ctx.merchants = (merchantRows ?? []).map((m) => ({
      name: m.name,
      countries: merchantCountryNames.get(m.id as string) ?? [],
      subdomain: m.subdomain,
      custom_domain: m.custom_domain,
      status: m.status,
      disabled_modules: m.disabled_modules,
    }));
  }

  // Owners — scope-filtered.
  const ownerScope = can(cu, "owners", "view");
  if (ownerScope && on("owners")) {
    let q = db()
      .from("owners")
      .select(
        "full_name, id_number, gender, marital_status, phone, email, status, reject_reason, notes, merchant_id, country_id, bank_account_no, created_at, bank:banks(name), occupation:occupations(name, company_type)"
      )
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (ownerScope === "merchant" && cu.user.merchant_id) q = q.eq("merchant_id", cu.user.merchant_id);
    if (ownerScope === "own") q = q.eq("created_by", cu.user.id);
    const { data: owners } = await q;
    ctx.owners = ((owners ?? []) as Row[]).map((o) => ({
      full_name: o.full_name,
      id_number: o.id_number,
      gender: o.gender,
      marital_status: o.marital_status,
      phone: o.phone,
      email: o.email,
      status: OWNER_STATUS_LABEL[(o.status as OwnerStatus) ?? "draft"],
      reject_reason: o.reject_reason,
      notes: o.notes,
      merchant: merchantName.get(o.merchant_id as string) ?? null,
      country: countryName.get(o.country_id as string) ?? null,
      bank: (o.bank as { name?: string } | null)?.name ?? null,
      bank_account_no: o.bank_account_no,
      occupation: (o.occupation as { name?: string } | null)?.name ?? null,
      company_type: (o.occupation as { company_type?: string } | null)?.company_type ?? null,
      created_at: o.created_at,
    }));
  }

  const companyScope = can(cu, "companies", "view");
  if (companyScope && on("companies")) {
    let q = db()
      .from("companies")
      .select(
        "name, company_id, company_type, business_start_date, status, province, district, subdistrict, street, address_no, postal_code, notes, merchant_id, country_id, created_at, members:company_members(role, share_percent, owner:owners(full_name))"
      )
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (companyScope === "merchant" && cu.user.merchant_id) q = q.eq("merchant_id", cu.user.merchant_id);
    if (companyScope === "own") q = q.eq("created_by", cu.user.id);
    const { data: companies } = await q;
    ctx.companies = ((companies ?? []) as Row[]).map((c) => ({
      name: c.name,
      company_id: c.company_id,
      company_type: c.company_type,
      business_start_date: c.business_start_date,
      status: c.status,
      address: [c.address_no, c.street, c.subdistrict, c.district, c.province, c.postal_code]
        .filter(Boolean)
        .join(", ") || null,
      province: c.province,
      district: c.district,
      merchant: merchantName.get(c.merchant_id as string) ?? null,
      country: countryName.get(c.country_id as string) ?? null,
      members: ((c.members as { role: string; share_percent: number | null; owner: { full_name?: string } | null }[]) ?? []).map(
        (m) => ({ role: m.role, name: m.owner?.full_name ?? null, share_percent: m.share_percent })
      ),
      notes: c.notes,
    }));
  }

  if (can(cu, "banks", "view") && on("banks")) {
    const { data: banks } = await db().from("banks").select("country_id, name, code, active").order("sort");
    ctx.banks = ((banks ?? []) as Row[]).map((b) => ({
      country: countryName.get(b.country_id as string) ?? null,
      name: b.name,
      code: b.code,
      active: b.active,
    }));
    const { data: occs } = await db().from("occupations").select("name, company_type, active").order("sort");
    ctx.occupations = occs ?? [];
  }

  if (!cu.merchant && can(cu, "telegram", "view") && on("telegram")) {
    const { data: bots } = await db()
      .from("telegram_bots")
      .select("name, bot_username, note, active, last_check_ok, last_check_at");
    ctx.telegram_bots = bots ?? []; // tokens intentionally excluded
  }

  const userScope = can(cu, "users", "view");
  if (userScope) {
    let q = db()
      .from("users")
      .select("username, name, email, merchant_id, is_superadmin, active, role:roles(name)")
      .limit(LIMIT);
    if (userScope !== "all") q = cu.user.merchant_id ? q.eq("merchant_id", cu.user.merchant_id) : q.is("merchant_id", null);
    const { data: users } = await q;
    ctx.users = ((users ?? []) as Row[]).map((u) => ({
      username: u.username,
      name: u.name,
      email: u.email,
      merchant: u.merchant_id ? merchantName.get(u.merchant_id as string) ?? null : "(platform)",
      role: u.is_superadmin ? "Superadmin" : (u.role as { name?: string } | null)?.name ?? null,
      active: u.active,
    }));
  }

  if (can(cu, "roles", "view")) {
    let q = db().from("roles").select("name, level, description, is_system, merchant_id");
    if (cu.merchant) q = q.or(`merchant_id.eq.${cu.merchant.id},and(is_system.eq.true,level.eq.merchant)`);
    const { data: roles } = await q;
    ctx.roles = ((roles ?? []) as Row[]).map((r) => ({
      name: r.name,
      level: r.level,
      description: r.description,
      is_system: r.is_system,
    }));
  }

  return JSON.stringify(ctx);
}

// ---------- Model calls ----------

export type ChatMessage = { role: "user" | "assistant"; content: string };

async function askClaude(s: AiSettings, system: string, messages: ChatMessage[]): Promise<string> {
  const client = new Anthropic({ apiKey: s.claude_api_key });
  const model = s.claude_model || AI_DEFAULTS.claude_model;
  // Adaptive thinking exists on Opus 4.6+/Sonnet 4.6+/Fable — Haiku rejects it.
  const supportsAdaptive = /^claude-(opus-4-[6-9]|sonnet-(4-6|5)|fable-5)/.test(model);
  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    ...(supportsAdaptive ? { thinking: { type: "adaptive" as const } } : {}),
    system,
    messages,
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
}

async function askChatGpt(s: AiSettings, system: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${s.chatgpt_api_key}` },
    body: JSON.stringify({
      model: s.chatgpt_model || AI_DEFAULTS.chatgpt_model,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `OpenAI request failed (${res.status})`);
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

/** Answer a conversation for the given user, with role-scoped data context. */
export async function answerWithAi(cu: CurrentUser, messages: ChatMessage[]): Promise<string> {
  const s = await aiSettings();
  if (!activeKey(s)) {
    throw new Error(
      "AI Assistant is not configured yet. A platform admin needs to add an API key under Settings → AI Assistant."
    );
  }

  const [platform, context] = await Promise.all([platformSettings(), buildAiContext(cu)]);
  const who = cu.merchant
    ? `${cu.user.name || cu.user.username} — merchant user of "${cu.merchant.name}" (role: ${cu.role?.name ?? "none"})`
    : `${cu.user.name || cu.user.username} — platform user (role: ${cu.isSuper ? "Superadmin" : cu.role?.name ?? "none"})`;

  const system = [
    `You are the built-in AI Assistant of "${platform.name}", a multi-tenant management platform (countries → merchants → owners and other business modules).`,
    `You answer questions about the platform's data for the signed-in user.`,
    ``,
    `Signed-in user: ${who}`,
    ``,
    `Rules:`,
    `- Answer ONLY from the JSON data below. It is already filtered to exactly what this user's role is allowed to see.`,
    `- If the data does not contain the answer, say so plainly — never invent records, numbers or names.`,
    `- Never mention data, merchants or records that are not present in the JSON, even if asked directly.`,
    `- Be concise and practical: short sentences, simple lists or small tables. Counts and totals must be computed from the JSON accurately.`,
    `- Reply in the same language the user writes in.`,
    ``,
    `Data (JSON):`,
    context,
  ].join("\n");

  return s.provider === "claude" ? askClaude(s, system, messages) : askChatGpt(s, system, messages);
}
