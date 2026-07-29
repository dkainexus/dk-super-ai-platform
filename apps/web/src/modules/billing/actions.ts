"use server";

// Billing actions: the monthly run and the life of an invoice.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { buildDraft, issueRun } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

const monthOf = (formData: FormData): string => {
  const raw = String(formData.get("month") ?? ""); // YYYY-MM from <input type=month>
  if (!/^\d{4}-\d{2}$/.test(raw)) fail("/admin/billing", "Pick the month to run");
  return `${raw}-01`;
};

/** Generate (or regenerate) the draft — this is both buttons in one action. */
export async function generateDraft(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "add");
  if (cu.merchant) redirect("/m");
  const month = monthOf(formData);
  const back = `/admin/billing?month=${month.slice(0, 7)}`;

  const { adminCountry } = await import("@/modules/countries/lib");
  const active = (await adminCountry()).active;
  if (!active) fail("/admin/billing", "Switch into a country first");

  try {
    await buildDraft(active.id, month, cu.user.id);
  } catch (e) {
    fail(back, e instanceof Error ? e.message : "The draft could not be built");
  }
  revalidatePath("/admin/billing");
  redirect(back);
}

export async function discardDraft(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  if (cu.merchant) redirect("/m");
  const runId = String(formData.get("run_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/billing");

  const { data: run } = await db().from("billing_runs").select("status").eq("id", runId).maybeSingle();
  if (!run) fail(back, "Run not found");
  if (run.status !== "draft") fail(back, "Only a draft can be discarded");

  await db().from("invoices").delete().eq("run_id", runId).eq("status", "draft");
  await db().from("billing_runs").delete().eq("id", runId);
  revalidatePath("/admin/billing");
  redirect(back);
}

/** The point of no return: drafts become real invoices and payouts. */
export async function approveAndIssue(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("billing", "edit");
  if (cu.merchant) redirect("/m");
  const runId = String(formData.get("run_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/billing");

  const { data: run } = await db().from("billing_runs").select("status").eq("id", runId).maybeSingle();
  if (!run) fail(back, "Run not found");
  if (run.status !== "draft") fail(back, "This run has already been issued");

  const count = await issueRun(runId, cu.user.id);
  revalidatePath("/admin/billing");
  redirect(`${back}${back.includes("?") ? "&" : "?"}issued=${count}`);
}

export async function markInvoicePaid(formData: FormData): Promise<void> {
  await requirePerm("billing", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/billing/invoices/${id}`);

  const { data } = await db().from("invoices").select("status").eq("id", id).maybeSingle();
  if (!data) fail(back, "Invoice not found");
  if (data.status !== "issued") fail(back, "Only an issued invoice can be marked paid");

  await db().from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/billing");
  redirect(back);
}

/**
 * Cancel an issued invoice. Its lines keep their dedupe keys on record, so the
 * next Recalculate raises the replacement — cancel, fix the terms, re-run.
 */
export async function cancelInvoice(formData: FormData): Promise<void> {
  await requirePerm("billing", "edit");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? `/admin/billing/invoices/${id}`);

  const { data } = await db().from("invoices").select("status").eq("id", id).maybeSingle();
  if (!data) fail(back, "Invoice not found");
  if (data.status === "paid") fail(back, "A paid invoice cannot be cancelled");

  await db().from("invoices").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", id);
  // Freeing the keys is what lets the replacement be raised.
  await db().from("invoice_lines").delete().eq("invoice_id", id);
  revalidatePath("/admin/billing");
  redirect(back);
}
