"use server";

// The spending ledger: company costs, staff claims, anything bought. A claim
// only counts as real cost once someone with the permission approves it.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { uploadFile, fileExt, DOCS_BUCKET } from "@/lib/storage";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

export async function createExpense(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("expenses", "add");
  if (cu.merchant) redirect("/m");
  const back = "/admin/expenses";
  const amount = parseFloat(String(formData.get("amount") ?? "").replace(/,/g, ""));
  const category = String(formData.get("category") ?? "").trim();
  if (!category) fail(back, "Pick a category");
  if (!Number.isFinite(amount) || amount <= 0) fail(back, "Enter the amount");

  const { adminCountry } = await import("@/modules/countries/lib");
  const active = (await adminCountry()).active;

  const file = formData.get("receipt");
  let receiptPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 20 * 1024 * 1024) fail(back, "Receipts must be under 20MB");
    receiptPath = await uploadFile(DOCS_BUCKET, `expenses/${Date.now()}.${fileExt(file)}`, file);
  }

  const isClaim = formData.get("is_claim") === "on";
  const { error } = await db().from("expenses").insert({
    country_id: active?.id ?? null,
    company_id: String(formData.get("company_id") ?? "") || null,
    merchant_id: String(formData.get("merchant_id") ?? "") || null,
    staff_user_id: isClaim ? cu.user.id : String(formData.get("staff_user_id") ?? "") || null,
    item: String(formData.get("item") ?? "").trim() || null,
    category,
    amount,
    currency: active?.currency ?? "THB",
    spent_on: String(formData.get("spent_on") ?? "") || new Date().toISOString().slice(0, 10),
    note: String(formData.get("note") ?? "").trim() || null,
    receipt_path: receiptPath,
    is_claim: isClaim,
    claim_status: isClaim ? "pending" : null,
    created_by: cu.user.id,
  });
  if (error) fail(back, `Failed to record: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function reviewExpenseClaim(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("expenses", "edit");
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "") === "approve" ? "approved" : "rejected";
  await db()
    .from("expenses")
    .update({ claim_status: decision, approved_by: cu.user.id, approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("claim_status", "pending");
  revalidatePath("/admin/expenses");
  redirect("/admin/expenses");
}

export async function deleteExpense(formData: FormData): Promise<void> {
  await requirePerm("expenses", "delete");
  await db().from("expenses").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin/expenses");
  redirect("/admin/expenses");
}

// ---------- Categories ----------

export async function saveExpenseCategory(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("expenses", "edit");
  if (cu.merchant) redirect("/m");
  const back = "/admin/expenses/categories";
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Name the category");

  if (id) {
    const { error } = await db().from("expense_categories").update({ name }).eq("id", id);
    if (error) fail(back, error.message.includes("duplicate") ? "That category already exists" : `Failed: ${error.message}`);
  } else {
    const { error } = await db().from("expense_categories").insert({
      country_id: String(formData.get("country_id") ?? ""),
      name,
    });
    if (error) fail(back, error.message.includes("duplicate") ? "That category already exists" : `Failed: ${error.message}`);
  }
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

export async function toggleExpenseCategory(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("expenses", "edit");
  if (cu.merchant) redirect("/m");
  await db()
    .from("expense_categories")
    .update({ active: String(formData.get("active") ?? "") === "true" })
    .eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin/expenses/categories");
  redirect("/admin/expenses/categories");
}
