"use server";

// Customers module actions: the renting side of the platform.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const STARTER_PASSWORD = "123456";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function revalidate() {
  revalidatePath("/admin/customers");
}

async function customerRoleId(): Promise<string | null> {
  const { data } = await db()
    .from("roles")
    .select("id")
    .eq("name", "Customer")
    .eq("level", "merchant")
    .eq("is_system", true)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function fields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    company_name: String(formData.get("company_name") ?? "").trim() || null,
    contact_name: String(formData.get("contact_name") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    belongs_to: String(formData.get("belongs_to") ?? "platform") === "white_label" ? "white_label" : "platform",
    deposit: parseFloat(String(formData.get("deposit") ?? "0")) || 0,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createCustomer(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("customers", "add");
  const back = "/admin/customers/new";
  const merchantId = String(formData.get("merchant_id") ?? "");
  const f = fields(formData);
  if (!merchantId) fail(back, "Please choose a white label");
  if (!f.name) fail(back, "Please enter the customer's name");

  const { adminCountry } = await import("@/modules/countries/lib");
  const countryId = (await adminCountry()).active?.id ?? null;

  const { data, error } = await db()
    .from("customers")
    .insert({ ...f, merchant_id: merchantId, country_id: countryId, created_by: cu.user.id })
    .select("id")
    .single();
  if (error || !data) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);

  revalidate();
  redirect(`/admin/customers/${data.id}`);
}

export async function updateCustomer(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("customers", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/customers/${id}`;
  const f = fields(formData);
  if (!f.name) fail(back, "Name cannot be empty");

  const { error } = await db()
    .from("customers")
    .update({ ...f, updated_at: new Date().toISOString(), updated_by: cu.user.id })
    .eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidate();
  redirect(back);
}

/**
 * Give the customer their portal sign-in. Username comes from the reference,
 * password starts as 123456 and must be changed at the first sign-in — the
 * same shape owners get in the app.
 */
export async function issueCustomerLogin(formData: FormData): Promise<void> {
  await requirePerm("customers", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/customers/${id}`;

  const { data } = await db().from("customers").select("*").eq("id", id).maybeSingle();
  if (!data) fail(back, "Customer not found");
  const row = data as { ref: string | null; name: string; merchant_id: string; user_id: string | null };

  const hash = await hashPassword(STARTER_PASSWORD);
  if (row.user_id) {
    // Already has one — this is the "Reset to 123456" button.
    const { error } = await db()
      .from("users")
      .update({ password_hash: hash, must_change_password: true, active: true })
      .eq("id", row.user_id);
    if (error) fail(back, `Failed to reset: ${error.message}`);
    revalidate();
    redirect(`${back}?saved=reset`);
  }

  const base = (row.ref ?? row.name).toLowerCase().replace(/[^a-z0-9]+/g, "") || "customer";
  let username = base;
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}${n}`;
    const { data: taken } = await db().from("users").select("id").eq("username", candidate).maybeSingle();
    if (!taken) {
      username = candidate;
      break;
    }
  }

  const { data: user, error } = await db()
    .from("users")
    .insert({
      username,
      name: row.name,
      password_hash: hash,
      merchant_id: row.merchant_id,
      role_id: await customerRoleId(),
      must_change_password: true,
    })
    .select("id")
    .single();
  if (error || !user) fail(back, `Failed to create the sign-in: ${error?.message}`);

  await db().from("customers").update({ user_id: user.id }).eq("id", id);
  revalidate();
  redirect(`${back}?saved=login`);
}

/** Suspend or reactivate — a suspended customer cannot sign in. */
export async function setCustomerStatus(formData: FormData): Promise<void> {
  await requirePerm("customers", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/customers/${id}`;
  const status = String(formData.get("status") ?? "active") === "suspended" ? "suspended" : "active";

  const { data } = await db().from("customers").select("user_id").eq("id", id).maybeSingle();
  if (!data) fail(back, "Customer not found");

  await db().from("customers").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (data.user_id) await db().from("users").update({ active: status === "active" }).eq("id", data.user_id);
  revalidate();
  redirect(back);
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  await requirePerm("customers", "delete");
  const id = String(formData.get("id") ?? "");

  const { count } = await db()
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id)
    .neq("status", "draft");
  if ((count ?? 0) > 0) fail(`/admin/customers/${id}`, "This customer has contracts on record — suspend them instead");

  const { data } = await db().from("customers").select("user_id").eq("id", id).maybeSingle();
  if (data?.user_id) await db().from("users").update({ active: false }).eq("id", data.user_id);
  await db().from("customers").delete().eq("id", id);
  revalidate();
  redirect("/admin/customers");
}
