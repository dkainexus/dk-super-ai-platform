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
  {
    // Give the new country its built-in province list straight away.
    const { seedProvinces } = await import("./provinces");
    const { data: created } = await db().from("countries").select("id, code").eq("code", code).maybeSingle();
    if (created) await seedProvinces(created.id, created.code);
  }
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
  const back = String(formData.get("back") ?? `/admin/countries/${id}`);
  const name = String(formData.get("name") ?? "").trim();
  const flag = String(formData.get("flag") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "UTC");
  const currency = String(formData.get("currency") ?? "USD").toUpperCase();
  if (!name) fail(back, "Country name cannot be empty");

  const { error } = await db().from("countries").update({
      name,
      flag,
      timezone,
      currency,
      new_account_reward: parseFloat(String(formData.get("new_account_reward") ?? "0")) || 0,
    }).eq("id", id);
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
  const back = String(formData.get("back") ?? `/admin/countries/${id}`);

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
  const back = String(formData.get("back") ?? `/admin/countries/${id}`);
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
  const back = String(formData.get("back") ?? `/admin/countries/${id}`);
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
  const { cookies } = await import("next/headers");
  const { ADMIN_COUNTRY_COOKIE } = await import("./lib");
  const jar = await cookies();
  jar.set(ADMIN_COUNTRY_COOKIE, id || "global", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  // Land on the dashboard: the page you were on may not exist in the new scope.
  redirect("/admin");
}

/** Country icon: uploaded once, shown in the scope switcher. */
export async function uploadCountryIcon(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/countries/${id}`);
  const file = formData.get("icon");
  if (!(file instanceof File) || file.size === 0) fail(back, "Please choose an image");
  if (!file.type.startsWith("image/")) fail(back, "The icon must be an image");
  const { ASSETS_BUCKET, fileExt, uploadFile } = await import("@/lib/storage");
  try {
    const path = await uploadFile(ASSETS_BUCKET, `country-icons/${id}.${fileExt(file)}`, file);
    await db().from("countries").update({ icon_path: path }).eq("id", id);
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "Icon upload failed");
  }
  revalidatePath("/", "layout");
  redirect(back);
}

export async function removeCountryIcon(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/countries/${id}`);
  const { ASSETS_BUCKET } = await import("@/lib/storage");
  const { data: c } = await db().from("countries").select("icon_path").eq("id", id).maybeSingle();
  if (c?.icon_path) await db().storage.from(ASSETS_BUCKET).remove([c.icon_path]);
  await db().from("countries").update({ icon_path: null }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(back);
}

// ---------- States / provinces ----------

/** Areas are one tree per country; `parent` decides which level you are adding to. */
export async function addRegion(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const countryId = String(formData.get("country_id") ?? "");
  const parentId = String(formData.get("parent_id") ?? "") || null;
  const level = Math.max(1, parseInt(String(formData.get("level") ?? "1"), 10) || 1);
  const back = String(formData.get("back") ?? "/admin/country/regions");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Please enter the name");

  let countQ = db().from("regions").select("id", { count: "exact", head: true }).eq("country_id", countryId);
  countQ = parentId ? countQ.eq("parent_id", parentId) : countQ.is("parent_id", null);
  const { count } = await countQ;

  const { error } = await db()
    .from("regions")
    .insert({ country_id: countryId, parent_id: parentId, level, name, sort: ((count ?? 0) + 1) * 10 });
  if (error) fail(back, error.message.includes("duplicate") ? "That one already exists here" : `Failed: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

/** Paste a whole level at once — one area per line. */
export async function addRegionsBulk(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const countryId = String(formData.get("country_id") ?? "");
  const parentId = String(formData.get("parent_id") ?? "") || null;
  const level = Math.max(1, parseInt(String(formData.get("level") ?? "1"), 10) || 1);
  const back = String(formData.get("back") ?? "/admin/country/regions");
  const names = [
    ...new Set(
      String(formData.get("names") ?? "")
        .split(/[\n,]/)
        .map((n) => n.trim())
        .filter(Boolean)
    ),
  ];
  if (names.length === 0) fail(back, "Paste at least one name");

  const { error } = await db()
    .from("regions")
    .upsert(
      names.map((name, i) => ({
        country_id: countryId,
        parent_id: parentId,
        level,
        name,
        sort: (i + 1) * 10,
      })),
      { onConflict: "country_id,parent_id,name" }
    );
  if (error) fail(back, `Failed to add: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function updateRegion(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const back = String(formData.get("back") ?? "/admin/country/regions");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Name cannot be empty");
  const { error } = await db().from("regions").update({ name }).eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function deleteRegion(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const back = String(formData.get("back") ?? "/admin/country/regions");
  await db().from("regions").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath(back);
  redirect(back);
}

/** The level names — and therefore the depth — of a country's addresses. */
export async function saveAddressLevels(formData: FormData): Promise<void> {
  await requirePerm("countries", "edit");
  const back = String(formData.get("back") ?? "/admin/country/regions");
  const countryId = String(formData.get("country_id") ?? "");
  const levels = [1, 2, 3]
    .map((n) => String(formData.get(`level_${n}`) ?? "").trim())
    .filter(Boolean);
  if (levels.length === 0) fail(back, "An address needs at least one level");

  const { error } = await db().from("countries").update({ address_levels: levels }).eq("id", countryId);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}
