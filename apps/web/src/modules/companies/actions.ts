"use server";

// Companies module actions. One save action serves both the platform side
// (/admin/companies) and the white label portal (/m/companies) — the caller's
// permission scope decides which merchants they can touch.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { companiesSettings, shareholdersEnabledFor } from "./lib";
import { merchantHasCountry, allowedCountries } from "@/modules/merchants/lib";
import type { Company, CompanyStatus } from "@/lib/types";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

const STATUSES: CompanyStatus[] = ["preparing", "registered", "closed", "banned"];

export async function saveCompany(formData: FormData): Promise<void> {
  const existingId = String(formData.get("id") ?? "") || null;
  const { cu, scope } = await requirePerm("companies", existingId ? "edit" : "add");
  const isMerchantSide = Boolean(cu.merchant);
  const base = isMerchantSide ? "/m/companies" : "/admin/companies";

  let merchantId: string;
  let countryId: string;
  let company: Company | null = null;

  if (existingId) {
    const { data } = await db().from("companies").select("*").eq("id", existingId).maybeSingle();
    if (!data) fail(base, "Company not found");
    company = data as Company;
    merchantId = company.merchant_id;
    countryId = company.country_id;
  } else {
    // New companies come from the platform side only.
    if (isMerchantSide) fail(base, "Companies are entered by the platform");
    merchantId = isMerchantSide ? cu.merchant!.id : String(formData.get("merchant_id") ?? "");
    const { data: m } = await db().from("merchants").select("id").eq("id", merchantId).maybeSingle();
    if (!m) fail(`${base}/new`, "Please choose a valid white label");
    countryId = String(formData.get("country_id") ?? "");
    if (!countryId || !(await merchantHasCountry(merchantId, countryId))) {
      fail(`${base}/new`, "Please choose one of the white label's countries");
    }
    if (isMerchantSide) {
      const allowed = await allowedCountries(cu);
      if (!allowed.some((c) => c.id === countryId)) fail(`${base}/new`, "You do not have access to that country");
    }
  }

  // Scope guard: merchant-scoped users can only touch their own white label.
  if (scope !== "all" && merchantId !== cu.user.merchant_id) redirect(base);
  const back = existingId ? `${base}/${existingId}` : `${base}/new`;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Please enter the company name");
  const status = String(formData.get("status") ?? "preparing") as CompanyStatus;
  if (!STATUSES.includes(status)) fail(back, "Invalid status");

  // The business starts the day the registration comes through, so the first
  // time a company reaches Registered we stamp the date ourselves.
  let startDate = String(formData.get("business_start_date") ?? "") || null;
  const becomingRegistered = status === "registered" && company?.status !== "registered";
  let fundingDue = 0;
  if (!startDate && becomingRegistered) {
    startDate = new Date().toISOString().slice(0, 10);
  }

  // Registering is when the white label's half of the company cost is taken.
  // Not enough in their wallet → the company does not register.
  if (becomingRegistered) {
    const { data: m } = await db()
      .from("merchants")
      .select("company_quote")
      .eq("id", merchantId)
      .maybeSingle();
    const share = Number(m?.company_quote ?? 0) / 2;
    if (share > 0) {
      const { ledgerFor } = await import("@/modules/billing/ledger");
      const { balance } = await ledgerFor("merchant", merchantId);
      if (balance < share) {
        fail(
          back,
          `Registering takes ${share.toLocaleString()} from the white label's wallet, which holds ${balance.toLocaleString()} — top it up first`
        );
      }
      fundingDue = share;
    }
  }

  const fields = {
    name,
    company_id: String(formData.get("company_id") ?? "").trim() || null,
    company_type: String(formData.get("company_type") ?? "").trim() || null,
    business_start_date: startDate,
    address_no: String(formData.get("address_no") ?? "").trim() || null,
    street: String(formData.get("street") ?? "").trim() || null,
    subdistrict: String(formData.get("subdistrict") ?? "").trim() || null,
    district: String(formData.get("district") ?? "").trim() || null,
    province: String(formData.get("province") ?? "").trim() || null,
    postal_code: String(formData.get("postal_code") ?? "").trim() || null,
    status,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };

  if (company) {
    const { error } = await db()
      .from("companies")
      .update({ ...fields, updated_at: new Date().toISOString(), updated_by: cu.user.id })
      .eq("id", company.id);
    if (error) fail(back, `Failed to save: ${error.message}`);
  } else {
    const { data, error } = await db()
      .from("companies")
      .insert({ ...fields, merchant_id: merchantId, country_id: countryId, created_by: cu.user.id })
      .select("*")
      .single();
    if (error || !data) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);
    company = data as Company;
  }

  // The funding is taken now that the company row exists to reference.
  if (fundingDue > 0 && company) {
    await db().from("ledger_entries").insert({
      merchant_id: merchantId,
      country_id: countryId,
      holder_type: "merchant",
      holder_id: merchantId,
      currency: "THB",
      amount: -fundingDue,
      kind: "adjustment",
      note: `company:${company.id} registration funding`,
      created_by: cu.user.id,
    });
  }

  // ----- Members: one company owner + optional shareholders -----
  const ownerId = String(formData.get("owner_id") ?? "");
  if (!ownerId) fail(back, "Please bind an owner to the company");
  const { data: ownerRow } = await db()
    .from("owners")
    .select("id, merchant_id, status")
    .eq("id", ownerId)
    .maybeSingle();
  if (!ownerRow || ownerRow.merchant_id !== merchantId) fail(back, "Owner must belong to the same white label");
  if (ownerRow.status === "banned") fail(back, "A banned owner cannot be bound to a company");

  const members: { owner_id: string; role: "owner" | "shareholder"; share_percent: number | null }[] = [
    { owner_id: ownerId, role: "owner", share_percent: null },
  ];

  if (await shareholdersEnabledFor(countryId)) {
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const shOwner = String(formData.get(`sh_owner_${i}`) ?? "");
      const shPercentRaw = String(formData.get(`sh_percent_${i}`) ?? "").trim();
      if (!shOwner) continue;
      const pct = parseFloat(shPercentRaw);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) fail(back, "Each shareholder needs a share % between 0 and 100");
      if (members.some((m) => m.owner_id === shOwner)) fail(back, "The same owner appears twice");
      const { data: sh } = await db().from("owners").select("id, merchant_id, status").eq("id", shOwner).maybeSingle();
      if (!sh || sh.merchant_id !== merchantId) fail(back, "Shareholders must belong to the same white label");
      if (sh.status === "banned") fail(back, "A banned owner cannot be a shareholder");
      total += pct;
      members.push({ owner_id: shOwner, role: "shareholder", share_percent: pct });
    }
    if (total > 100) fail(back, `Shareholder total is ${total}% — it cannot exceed 100%`);
  }

  await db().from("company_members").delete().eq("company_id", company.id);
  const { error: memberError } = await db()
    .from("company_members")
    .insert(members.map((m) => ({ ...m, company_id: company!.id })));
  if (memberError) fail(back, `Failed to save members: ${memberError.message}`);

  revalidatePath(base);
  redirect(`${base}/${company.id}`);
}

export async function deleteCompany(formData: FormData): Promise<void> {
  const { cu, scope } = await requirePerm("companies", "delete");
  const base = cu.merchant ? "/m/companies" : "/admin/companies";
  const id = String(formData.get("id") ?? "");
  const { data } = await db().from("companies").select("id, merchant_id").eq("id", id).maybeSingle();
  if (!data) redirect(base);
  if (scope !== "all" && data.merchant_id !== cu.user.merchant_id) redirect(base);
  await db().from("companies").delete().eq("id", id);
  revalidatePath(base);
  redirect(base);
}

/** Turn the shareholders section on or off for one country. */
export async function toggleShareholders(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("settings", "edit");
  if (cu.merchant) redirect("/m");
  const countryId = String(formData.get("country_id") ?? "");
  const on = formData.get("on") === "1";
  const back = String(formData.get("back") ?? "/admin/settings/companies");
  if (!countryId) fail(back, "No country selected");

  const current = await companiesSettings();
  const set = new Set(current.shareholder_countries);
  if (on) set.add(countryId);
  else set.delete(countryId);
  current.shareholder_countries = [...set];
  await setSetting("companies", current);
  revalidatePath(back);
  redirect(back);
}

// ---------- Company types (per country) ----------

export async function createCompanyType(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("companies", "edit");
  if (cu.merchant) redirect("/m");
  const back = "/admin/companies/types";
  const countryId = String(formData.get("country_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!countryId) fail(back, "No country selected");
  if (!name) fail(back, "Please enter a name");

  const { count } = await db()
    .from("company_types")
    .select("id", { count: "exact", head: true })
    .eq("country_id", countryId);
  const { error } = await db()
    .from("company_types")
    .insert({ country_id: countryId, name, sort: ((count ?? 0) + 1) * 10, is_default: (count ?? 0) === 0 });
  if (error)
    fail(back, error.message.includes("duplicate") ? "That type already exists here" : `Failed to add: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function renameCompanyType(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("companies", "edit");
  if (cu.merchant) redirect("/m");
  const back = "/admin/companies/types";
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Name cannot be empty");
  await db().from("company_types").update({ name }).eq("id", id);
  revalidatePath(back);
  redirect(back);
}

/** Exactly one default per country — the one the company form preselects. */
export async function setDefaultCompanyType(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("companies", "edit");
  if (cu.merchant) redirect("/m");
  const back = "/admin/companies/types";
  const id = String(formData.get("id") ?? "");
  const countryId = String(formData.get("country_id") ?? "");
  await db().from("company_types").update({ is_default: false }).eq("country_id", countryId);
  await db().from("company_types").update({ is_default: true }).eq("id", id);
  revalidatePath(back);
  redirect(back);
}

export async function deleteCompanyType(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("companies", "delete");
  if (cu.merchant) redirect("/m");
  const back = "/admin/companies/types";
  await db().from("company_types").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath(back);
  redirect(back);
}
