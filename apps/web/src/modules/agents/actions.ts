"use server";

// Agents module actions: create an agent, issue their sign-in, suspend them.

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function revalidate() {
  revalidatePath("/admin/agents");
  revalidatePath("/m/agents");
}

async function agentRoleId(): Promise<string | null> {
  const { data } = await db()
    .from("roles")
    .select("id")
    .eq("name", "Agent")
    .eq("level", "merchant")
    .eq("is_system", true)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function createAgent(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("agents", "add");
  const list = cu.merchant ? "/m/agents" : "/admin/agents";
  const back = `${list}/new`;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const merchantId = cu.merchant ? cu.merchant.id : String(formData.get("merchant_id") ?? "");
  if (!fullName) fail(back, "Please enter the agent's name");
  if (!merchantId) fail(back, "Please choose a white label");

  let countryId = String(formData.get("country_id") ?? "") || null;
  if (!countryId && !cu.merchant) {
    const { adminCountry } = await import("@/modules/countries/lib");
    countryId = (await adminCountry()).active?.id ?? null;
  }

  const { data, error } = await db()
    .from("agents")
    .insert({
      merchant_id: merchantId,
      country_id: countryId,
      full_name: fullName,
      email: String(formData.get("email") ?? "").trim() || null,
      // The agent finishes their own sign-up through this link.
      invite_token: randomBytes(24).toString("base64url"),
      invited_at: new Date().toISOString(),
      created_by: cu.user.id,
    })
    .select("id")
    .single();
  if (error || !data) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);

  revalidate();
  redirect(`${list}/${data.id}`);
}

export async function updateAgent(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("agents", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? (cu.merchant ? "/m/agents" : "/admin/agents"));
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) fail(back, "Name cannot be empty");

  let q = db()
    .from("agents")
    .update({
      full_name: fullName,
      email: String(formData.get("email") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { error } = await q;
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidate();
  redirect(back);
}

/** Suspend or reactivate — a suspended agent cannot sign in. */
export async function setAgentStatus(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("agents", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? (cu.merchant ? "/m/agents" : "/admin/agents"));
  const status = String(formData.get("status") ?? "active") === "suspended" ? "suspended" : "active";

  let q = db().from("agents").select("user_id, merchant_id").eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { data } = await q.maybeSingle();
  if (!data) fail(back, "Agent not found");

  await db().from("agents").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (data.user_id) await db().from("users").update({ active: status === "active" }).eq("id", data.user_id);
  revalidate();
  redirect(back);
}

/** Give the agent a back-office sign-in (or reset the password on an existing one). */
export async function issueAgentLogin(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("agents", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? (cu.merchant ? "/m/agents" : "/admin/agents"));
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();

  if (!/^[a-z0-9_.@-]{3,40}$/.test(username))
    fail(back, "Username: 3-40 chars, letters/numbers/._@- only");
  if (password.length < 6) fail(back, "Password must be at least 6 characters");

  let q = db().from("agents").select("*").eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { data } = await q.maybeSingle();
  if (!data) fail(back, "Agent not found");
  const row = data as { user_id: string | null; merchant_id: string; full_name: string };

  const hash = await hashPassword(password);
  if (row.user_id) {
    const { error } = await db()
      .from("users")
      .update({ username, password_hash: hash, must_change_password: true, active: true })
      .eq("id", row.user_id);
    if (error)
      fail(back, error.message.includes("duplicate") ? "That username is taken" : `Failed to save: ${error.message}`);
  } else {
    const { data: user, error } = await db()
      .from("users")
      .insert({
        username,
        name: row.full_name,
        password_hash: hash,
        merchant_id: row.merchant_id,
        role_id: await agentRoleId(),
        must_change_password: true,
      })
      .select("id")
      .single();
    if (error || !user)
      fail(back, error?.message.includes("duplicate") ? "That username is taken" : `Failed to create: ${error?.message}`);
    await db()
      .from("agents")
      .update({ user_id: user.id, joined_at: new Date().toISOString(), invite_token: null })
      .eq("id", id);
  }

  revalidate();
  redirect(`${back}?saved=login`);
}

export async function deleteAgent(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("agents", "delete");
  const id = String(formData.get("id") ?? "");
  const list = cu.merchant ? "/m/agents" : "/admin/agents";

  let q = db().from("agents").select("user_id, merchant_id").eq("id", id);
  if (cu.merchant) q = q.eq("merchant_id", cu.merchant.id);
  const { data } = await q.maybeSingle();
  if (data?.user_id) await db().from("users").update({ active: false }).eq("id", data.user_id);
  await db().from("agents").delete().eq("id", id);

  revalidate();
  redirect(list);
}
