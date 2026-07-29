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
  if (!cu) redirect("/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/login");

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
