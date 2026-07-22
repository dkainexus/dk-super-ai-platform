"use server";

// Countries module actions (core). A country is the workspace every white
// label lives in — it carries the timezone and currency for its region.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

// ---------- Countries ----------

export async function createCountry(formData: FormData): Promise<void> {
  await requirePerm("countries", "add");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const flag = String(formData.get("flag") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "UTC");
  const currency = String(formData.get("currency") ?? "USD").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) fail("/admin/countries", "Country code must be 2 letters, e.g. TH");
  if (!name) fail("/admin/countries", "Please enter a country name");

  const { error } = await db().from("countries").insert({ code, name, flag, timezone, currency });
  if (error) fail("/admin/countries", `Failed to create: ${error.message}`);
  revalidatePath("/admin/countries");
}

export async function toggleCountry(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await db().from("countries").update({ active }).eq("id", id);
  revalidatePath("/admin/countries");
}


/** Country settings: name / flag / timezone / currency / sort. */
export async function updateCountry(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/countries/${id}`;
  const name = String(formData.get("name") ?? "").trim();
  const flag = String(formData.get("flag") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "UTC");
  const currency = String(formData.get("currency") ?? "USD").toUpperCase();
  const sort = parseInt(String(formData.get("sort") ?? "100"), 10) || 100;
  if (!name) fail(back, "Country name cannot be empty");

  const { error } = await db().from("countries").update({ name, flag, timezone, currency, sort }).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath("/admin/countries");
  redirect(back);
}
