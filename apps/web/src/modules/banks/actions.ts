"use server";

// Banks module actions.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";

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

  const { error } = await db().from("banks").update({ name, code, sort, active }).eq("id", id);
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

