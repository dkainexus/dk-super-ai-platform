"use server";

// The customer's own actions — everything here re-checks that the signed-in
// user is the customer it claims to act for.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { customerForUser } from "@/modules/customers/lib";
import { uploadFile, fileExt, DOCS_BUCKET } from "@/lib/storage";

function fail(message: string): never {
  redirect(`/portal/turnover?error=${encodeURIComponent(message)}`);
}

/** Declare one account's turnover for one month, with the statement to prove it. */
export async function submitTurnover(formData: FormData): Promise<void> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");

  const bankAccountId = String(formData.get("bank_account_id") ?? "");
  const periodMonth = String(formData.get("period_month") ?? "");
  const amount = parseFloat(String(formData.get("amount") ?? "").replace(/,/g, ""));
  if (!/^\d{4}-\d{2}-01$/.test(periodMonth)) fail("Pick the month");
  if (!Number.isFinite(amount) || amount < 0) fail("Enter the month's turnover");

  // The account must be theirs, through a contract.
  const { data: line } = await db()
    .from("contract_accounts")
    .select("id, contract:contracts!inner(customer_id)")
    .eq("bank_account_id", bankAccountId)
    .eq("contract.customer_id", customer.id)
    .limit(1)
    .maybeSingle();
  if (!line) fail("That account is not on your contracts");

  const file = formData.get("statement");
  let statementPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) fail("The statement must be under 8MB");
    statementPath = await uploadFile(
      DOCS_BUCKET,
      `statements/${customer.id}/${periodMonth.slice(0, 7)}-${bankAccountId}.${fileExt(file)}`,
      file
    );
  }
  if (!statementPath) fail("Attach the bank statement for the month");

  // A rejected declaration is resubmitted in place; pending or approved is final.
  const { data: existing } = await db()
    .from("turnover_declarations")
    .select("id, status")
    .eq("bank_account_id", bankAccountId)
    .eq("period_month", periodMonth)
    .maybeSingle();

  if (existing && existing.status !== "rejected") fail("That month has already been submitted");

  if (existing) {
    await db()
      .from("turnover_declarations")
      .update({ amount, statement_path: statementPath, status: "pending", reject_reason: null })
      .eq("id", existing.id);
  } else {
    const { error } = await db().from("turnover_declarations").insert({
      bank_account_id: bankAccountId,
      customer_id: customer.id,
      period_month: periodMonth,
      amount,
      statement_path: statementPath,
    });
    if (error) fail(`Failed to submit: ${error.message}`);
  }

  revalidatePath("/portal/turnover");
  redirect("/portal/turnover?saved=1");
}

function failTo(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** Report a problem on a rented account — balance and last transaction included. */
export async function submitTicket(formData: FormData): Promise<void> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");

  const bankAccountId = String(formData.get("bank_account_id") ?? "");
  const typeId = String(formData.get("type_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const balance = parseFloat(String(formData.get("reported_balance") ?? "").replace(/,/g, ""));
  const lastTx = String(formData.get("last_transaction") ?? "").trim();
  if (!description) failTo("/portal/support", "Describe the problem");
  if (!Number.isFinite(balance)) failTo("/portal/support", "Enter the account's current balance");
  if (!lastTx) failTo("/portal/support", "Describe the last transaction (date and amount)");

  const { data: line } = await db()
    .from("contract_accounts")
    .select("id, contract:contracts!inner(customer_id, merchant_id, country_id)")
    .eq("bank_account_id", bankAccountId)
    .eq("contract.customer_id", customer.id)
    .limit(1)
    .maybeSingle();
  if (!line) failTo("/portal/support", "That account is not on your contracts");
  const contract = line.contract as unknown as { merchant_id: string; country_id: string | null };

  const { data: ticketRow, error } = await db()
    .from("tickets")
    .insert({
      merchant_id: contract.merchant_id,
      country_id: contract.country_id,
      bank_account_id: bankAccountId,
      customer_id: customer.id,
      type_id: typeId || null,
      description,
      reported_balance: balance,
      last_transaction: lastTx,
    })
    .select("id")
    .single();
  if (error || !ticketRow) failTo("/portal/support", `Failed to report: ${error?.message}`);

  const file = formData.get("screenshot");
  if (file instanceof File && file.size > 0 && file.size <= 20 * 1024 * 1024) {
    const path = await uploadFile(DOCS_BUCKET, `tickets/${ticketRow.id}/report.${fileExt(file)}`, file);
    await db().from("ticket_messages").insert({
      ticket_id: ticketRow.id,
      author_type: "customer",
      author_id: customer.id,
      body: null,
      attachment_path: path,
    });
  }

  revalidatePath("/portal/support");
  redirect(`/portal/support/${ticketRow.id}?saved=1`);
}

/** A reply (or requested document) from the customer on their own ticket. */
export async function replyTicket(formData: FormData): Promise<void> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");

  const ticketId = String(formData.get("ticket_id") ?? "");
  const back = `/portal/support/${ticketId}`;
  const body = String(formData.get("body") ?? "").trim();

  const { data: t } = await db().from("tickets").select("customer_id").eq("id", ticketId).maybeSingle();
  if (!t || t.customer_id !== customer.id) redirect("/portal/support");

  const file = formData.get("attachment");
  let path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 20 * 1024 * 1024) failTo(back, "Attachments must be under 20MB");
    path = await uploadFile(DOCS_BUCKET, `tickets/${ticketId}/${Date.now()}.${fileExt(file)}`, file);
  }
  if (!body && !path) failTo(back, "Write something or attach a file");

  await db().from("ticket_messages").insert({
    ticket_id: ticketId,
    author_type: "customer",
    author_id: customer.id,
    body: body || null,
    attachment_path: path,
  });
  revalidatePath(back);
  redirect(back);
}
