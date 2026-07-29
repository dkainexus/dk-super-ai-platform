"use server";

// Banks module actions.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { ASSETS_BUCKET, fileExt, uploadFile } from "@/lib/storage";
import { resolveBranch } from "./lib";


function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

// ---------- Banks module ----------

export async function createBank(formData: FormData): Promise<void> {
  await requirePerm("banks", "add");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/banks?country=${countryId}`;
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase() || null;
  if (!countryId) fail("/admin/banks", "Please choose a country");
  if (!name) fail(back, "Please enter the bank name");

  const { count } = await db().from("banks").select("id", { count: "exact", head: true }).eq("country_id", countryId);
  const { error } = await db().from("banks").insert({
    country_id: countryId,
    name,
    code,
    sort: ((count ?? 0) + 1) * 10,
  });
  if (error) fail(back, error.message.includes("duplicate") ? "This bank already exists in this country" : `Failed to create: ${error.message}`);
  revalidatePath("/admin/banks");
  redirect(back);
}

export async function updateBank(formData: FormData): Promise<void> {
  await requirePerm("banks", "edit");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  const back = `/admin/banks?country=${countryId}`;
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase() || null;
  const sort = parseInt(String(formData.get("sort") ?? "100"), 10) || 100;
  const active = formData.get("active") === "on";
  if (!name) fail(back, "Bank name cannot be empty");

  // Ticked subsets of the country's pools (extra account fields + payment channels)
  const { data: country } = await db()
    .from("countries")
    .select("account_fields")
    .eq("id", countryId)
    .maybeSingle();
  const pool = (country?.account_fields ?? []) as { key: string; label: string }[];
  const ticked = new Set(formData.getAll("account_fields").map(String));
  const accountFields = pool.filter((f) => ticked.has(f.key));
  const channels = formData.getAll("channels").map(String).filter(Boolean);

  const patch: Record<string, unknown> = { name, code, sort, active, account_fields: accountFields, channels };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!logo.type.startsWith("image/")) fail(back, "The logo must be an image");
    try {
      patch.logo_path = await uploadFile(ASSETS_BUCKET, `bank-logos/${id}.${fileExt(logo)}`, logo);
    } catch (e) {
      fail(back, e instanceof Error ? e.message : "Logo upload failed");
    }
  }

  const { error } = await db().from("banks").update(patch).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath("/admin/banks");
  redirect(back);
}

export async function deleteBank(formData: FormData): Promise<void> {
  await requirePerm("banks", "delete");
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  await db().from("banks").delete().eq("id", id);
  revalidatePath("/admin/banks");
  redirect(countryId ? `/admin/banks?country=${countryId}` : "/admin/banks");
}


// ---------- Branches (sub-menu of Banks) ----------

export async function addBranch(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("banks", "add");
  const bankId = String(formData.get("bank_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/banks/branches");
  try {
    const branch = await resolveBranch(bankId, formData, cu.user.id);
    if (!branch) fail(back, "Search and pick the branch on Google Maps first");
  } catch (e) {
    fail(back, e instanceof Error ? `Failed to add: ${e.message}` : "Failed to add branch");
  }
  revalidatePath("/admin/banks/branches");
  revalidatePath("/", "layout");
  redirect(back);
}

export async function updateBranch(formData: FormData): Promise<void> {
  await requirePerm("banks", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/banks/branches");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Branch name cannot be empty");
  const { error } = await db()
    .from("bank_branches")
    .update({ name, address: String(formData.get("address") ?? "").trim() || null })
    .eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath("/admin/banks/branches");
  redirect(back);
}

export async function deleteBranch(formData: FormData): Promise<void> {
  await requirePerm("banks", "delete");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/banks/branches");
  const { error } = await db().from("bank_branches").delete().eq("id", id);
  if (error) fail(back, error.message.includes("foreign") ? "This branch is used by bank accounts" : `Failed to delete: ${error.message}`);
  revalidatePath("/admin/banks/branches");
  revalidatePath("/", "layout");
  redirect(back);
}
