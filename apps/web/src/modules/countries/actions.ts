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
  if (!/^[A-Z]{2}$/.test(code)) fail("/admin/countries", "Please select a country");
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
  if (!name) fail(back, "Country name cannot be empty");

  const { error } = await db().from("countries").update({ name, flag, timezone, currency }).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath("/admin/countries");
  redirect(back);
}

/** Flip one module on/off for this country. */
export async function toggleCountryModule(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("country_id") ?? "");
  const key = String(formData.get("key") ?? "");
  const on = String(formData.get("on") ?? "") === "1";
  const back = `/admin/countries/${id}`;

  const { data: c } = await db().from("countries").select("disabled_modules").eq("id", id).maybeSingle();
  const disabled = new Set(((c?.disabled_modules ?? []) as string[]));
  if (on) disabled.delete(key);
  else disabled.add(key);

  const { error } = await db().from("countries").update({ disabled_modules: [...disabled] }).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  revalidatePath("/", "layout");
  redirect(back);
}

/** Add a payment channel to this country (banks tick them per bank). */
export async function addPaymentChannel(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${id}`;
  const name = String(formData.get("channel") ?? "").trim();
  if (!name) fail(back, "Please enter a channel name");

  const { data: c } = await db().from("countries").select("payment_channels").eq("id", id).maybeSingle();
  const list = ((c?.payment_channels ?? []) as string[]).filter(Boolean);
  if (list.some((x) => x.toLowerCase() === name.toLowerCase())) fail(back, "This channel already exists");
  const { error } = await db().from("countries").update({ payment_channels: [...list, name] }).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

/** Remove a payment channel from this country (banks keep historical data). */
export async function removePaymentChannel(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("country_id") ?? "");
  const back = `/admin/countries/${id}`;
  const name = String(formData.get("channel") ?? "");
  const { data: c } = await db().from("countries").select("payment_channels").eq("id", id).maybeSingle();
  const list = ((c?.payment_channels ?? []) as string[]).filter((x) => x !== name);
  const { error } = await db().from("countries").update({ payment_channels: list }).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}


/** Switch the platform admin's active country (empty = all countries). */
export async function switchAdminCountry(formData: FormData): Promise<void> {
  await requirePerm("countries", "view");
  const id = String(formData.get("country_id") ?? "");
  const path = String(formData.get("path") ?? "/admin");
  const { cookies } = await import("next/headers");
  const { ADMIN_COUNTRY_COOKIE } = await import("./lib");
  const jar = await cookies();
  if (id) {
    jar.set(ADMIN_COUNTRY_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  } else {
    jar.delete(ADMIN_COUNTRY_COOKIE);
  }
  revalidatePath("/", "layout");
  redirect(path.startsWith("/admin") ? path : "/admin");
}
