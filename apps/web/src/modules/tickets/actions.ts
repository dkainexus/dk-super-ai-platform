"use server";

// Ticket actions — CS side. The customer files theirs through the portal.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { uploadFile, fileExt, DOCS_BUCKET } from "@/lib/storage";
import { addDays } from "@/modules/billing/engine";
import { escortThreshold, type Ticket, type TicketType } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

function revalidate(id?: string) {
  revalidatePath("/admin/tickets");
  if (id) revalidatePath(`/admin/tickets/${id}`);
}

const today = () => new Date().toISOString().slice(0, 10);

/** CS triage: who handles it and by when. Escort is forced above the threshold. */
export async function assignTicket(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("tickets", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/tickets/${id}`;
  const assignee = String(formData.get("assigned_to") ?? "");
  if (!["owner", "phone_cs", "customer"].includes(assignee)) fail(back, "Pick who handles it");

  const { data } = await db().from("tickets").select("*").eq("id", id).maybeSingle();
  if (!data) fail(back, "Ticket not found");
  const t = data as Ticket;
  if (t.status === "handled" || t.status === "resolved") fail(back, "This ticket is closed");

  let escortName: string | null = String(formData.get("escort_name") ?? "").trim() || null;
  let escortRequired = t.escort_required;
  if (assignee === "owner") {
    const threshold = await escortThreshold(t.merchant_id, t.country_id);
    if (threshold != null && t.reported_balance != null && Number(t.reported_balance) >= threshold) {
      escortRequired = true;
      if (!escortName) fail(back, `The balance is over ${threshold.toLocaleString()} — name who goes with the owner`);
    }
  } else {
    escortName = null;
  }

  const windowDays = Math.max(1, parseInt(String(formData.get("window_days") ?? "14"), 10) || 14);
  await db()
    .from("tickets")
    .update({
      status: "assigned",
      assigned_to: assignee,
      deadline: addDays(today(), windowDays),
      escort_required: escortRequired,
      escort_name: escortName,
      assigned_by: cu.user.id,
      assigned_at: new Date().toISOString(),
    })
    .eq("id", id);

  // The owner hears about it in the app; their deadline is the point.
  if (assignee === "owner") {
    const { data: acc } = await db().from("bank_accounts").select("owner_id, account_no").eq("id", t.bank_account_id).maybeSingle();
    if (acc?.owner_id) {
      const { notifyOwner } = await import("@/modules/notifications/lib");
      await notifyOwner(
        acc.owner_id,
        "general",
        "An account needs your attention",
        `Account ${acc.account_no}: ${t.description.slice(0, 140)} — please handle it within ${windowDays} days and upload proof.`,
        cu.user.id
      ).catch(() => {});
    }
  }

  revalidate(id);
  redirect(back);
}

/** A reply or a piece of evidence from the staff side. */
export async function addTicketMessage(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("tickets", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/tickets/${id}`;
  const body = String(formData.get("body") ?? "").trim();

  const file = formData.get("attachment");
  let path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 20 * 1024 * 1024) fail(back, "Attachments must be under 20MB");
    path = await uploadFile(DOCS_BUCKET, `tickets/${id}/${Date.now()}.${fileExt(file)}`, file);
  }
  if (!body && !path) fail(back, "Write something or attach the evidence");

  await db().from("ticket_messages").insert({
    ticket_id: id,
    author_type: "staff",
    author_id: cu.user.id,
    body: body || null,
    attachment_path: path,
  });
  revalidate(id);
  redirect(back);
}

/**
 * Close the ticket. Either way the service charge is raised — how it was
 * handled picks the price — and the next run collects it, unless CS waives it.
 */
export async function closeTicket(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("tickets", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/tickets/${id}`;
  const outcome = String(formData.get("outcome") ?? "") === "resolved" ? "resolved" : "handled";

  const { data } = await db().from("tickets").select("*, type:ticket_types(*)").eq("id", id).maybeSingle();
  if (!data) fail(back, "Ticket not found");
  const t = data as Ticket & { type: TicketType | null };
  if (t.status === "handled" || t.status === "resolved") fail(back, "Already closed");

  // Phone CS handled it → phone price; the owner went → visit price; the
  // customer supplying documents costs nothing.
  let chargeKind: "phone" | "visit" | null = null;
  if (t.assigned_to === "phone_cs") chargeKind = "phone";
  if (t.assigned_to === "owner") chargeKind = "visit";
  const chargeAmount =
    chargeKind && t.type ? Number(chargeKind === "phone" ? t.type.phone_price : t.type.visit_price) : null;

  await db()
    .from("tickets")
    .update({
      status: outcome,
      charge_kind: chargeKind,
      charge_amount: chargeAmount && chargeAmount > 0 ? chargeAmount : null,
      closed_by: cu.user.id,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidate(id);
  redirect(`${back}?saved=${outcome}`);
}

export async function waiveCharge(formData: FormData): Promise<void> {
  await requirePerm("tickets", "edit");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/tickets/${id}`;
  const { data } = await db().from("tickets").select("charge_invoiced_at").eq("id", id).maybeSingle();
  if (data?.charge_invoiced_at) fail(back, "Already on an invoice — adjust it there");
  await db().from("tickets").update({ charge_waived: true }).eq("id", id);
  revalidate(id);
  redirect(back);
}

/** Stop the money by hand — the automatic rule covers only missed deadlines. */
export async function setAccountFreeze(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("tickets", "edit");
  const accountId = String(formData.get("bank_account_id") ?? "");
  const back = String(formData.get("back") ?? "/admin/tickets");
  const freeze = formData.get("freeze") === "1";

  await db()
    .from("bank_accounts")
    .update(
      freeze
        ? {
            billing_frozen: true,
            frozen_at: new Date().toISOString(),
            frozen_reason: String(formData.get("reason") ?? "").trim() || `Frozen by ${cu.user.username}`,
          }
        : { billing_frozen: false, frozen_at: null, frozen_reason: null }
    )
    .eq("id", accountId);
  revalidate();
  revalidatePath(back);
  redirect(back);
}

// ---------- Ticket types (settings) ----------

export async function createTicketType(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("tickets", "edit");
  if (cu.merchant) redirect("/m");
  const back = "/admin/tickets/types";
  const countryId = String(formData.get("country_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Name the problem type");

  const { error } = await db().from("ticket_types").insert({
    country_id: countryId,
    merchant_id: String(formData.get("merchant_id") ?? "") || null,
    name,
    default_assignee: String(formData.get("default_assignee") ?? "owner"),
    window_days: Math.max(1, parseInt(String(formData.get("window_days") ?? "14"), 10) || 14),
    phone_price: parseFloat(String(formData.get("phone_price") ?? "0")) || 0,
    visit_price: parseFloat(String(formData.get("visit_price") ?? "0")) || 0,
  });
  if (error) fail(back, error.message.includes("duplicate") ? "That type already exists here" : `Failed: ${error.message}`);
  revalidatePath(back);
  redirect(back);
}

export async function updateTicketType(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("tickets", "edit");
  if (cu.merchant) redirect("/m");
  const back = "/admin/tickets/types";
  const id = String(formData.get("id") ?? "");
  // The row's bin button submits the same form with a marker.
  if (formData.get("__delete")) {
    await requirePerm("tickets", "delete");
    await db().from("ticket_types").delete().eq("id", id);
    revalidatePath(back);
    redirect(back);
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Name cannot be empty");

  await db()
    .from("ticket_types")
    .update({
      name,
      default_assignee: String(formData.get("default_assignee") ?? "owner"),
      window_days: Math.max(1, parseInt(String(formData.get("window_days") ?? "14"), 10) || 14),
      phone_price: parseFloat(String(formData.get("phone_price") ?? "0")) || 0,
      visit_price: parseFloat(String(formData.get("visit_price") ?? "0")) || 0,
      active: formData.get("active") === "on",
    })
    .eq("id", id);
  revalidatePath(back);
  redirect(back);
}

export async function deleteTicketType(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("tickets", "delete");
  if (cu.merchant) redirect("/m");
  await db().from("ticket_types").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin/tickets/types");
  redirect("/admin/tickets/types");
}
