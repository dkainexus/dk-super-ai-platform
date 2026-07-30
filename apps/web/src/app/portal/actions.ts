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

/**
 * The customer accepts an assignment: the confirmation is recorded against
 * the exact conditions and T&C version frozen at assignment. Mail needs an
 * address (saved for next time); direct binding opens a free support ticket.
 */
export async function confirmAssignment(formData: FormData): Promise<void> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");
  const id = String(formData.get("id") ?? "");
  const back = "/portal/agreements";
  const failTo = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  const { data } = await db()
    .from("account_assignments")
    .select("*")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!data) failTo("Assignment not found");
  const a = data as import("@/modules/contracts/customer-policy").Assignment;
  if (a.status !== "awaiting_confirmation") failTo("Already confirmed");

  if (String(formData.get("accept") ?? "") !== "yes") {
    failTo("Please tick that you have read and accept the terms");
  }

  // The customer picks how they take delivery.
  const delivery = String(formData.get("delivery_method") ?? "") === "shipping" ? "shipping" : "direct";

  // Shipping needs somewhere to send it.
  let address: { name: string; phone: string; address: string } | null = null;
  if (delivery === "shipping") {
    const addrId = String(formData.get("address_id") ?? "");
    if (addrId) {
      const { data: saved } = await db()
        .from("customer_addresses")
        .select("name, phone, address")
        .eq("id", addrId)
        .eq("customer_id", customer.id)
        .maybeSingle();
      if (!saved) failTo("That saved address wasn't found");
      address = saved as { name: string; phone: string; address: string };
    } else {
      const name = String(formData.get("addr_name") ?? "").trim();
      const phone = String(formData.get("addr_phone") ?? "").trim();
      const addr = String(formData.get("addr_address") ?? "").trim();
      if (!name || !phone || !addr) failTo("Shipping needs a name, phone and address");
      address = { name, phone, address: addr };
      await db().from("customer_addresses").insert({ customer_id: customer.id, ...address });
    }
  }

  const { data: locked } = await db()
    .from("account_assignments")
    .update({
      status: "confirmed",
      delivery_method: delivery,
      confirmed_at: new Date().toISOString(),
      address,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "awaiting_confirmation")
    .select("id");
  if (!locked || locked.length === 0) failTo("Already confirmed");

  // The billing contract exists from this moment — dormant until it goes live.
  const { wireCustomerContract } = await import("@/modules/contracts/customer-policy");
  await wireCustomerContract({ ...a, status: "confirmed" }, cu.user.id);

  // Shipping goes into the shipping queue; direct binding through support.
  if (delivery === "shipping" && address) {
    await db().from("shipments").insert({
      merchant_id: a.merchant_id,
      country_id: a.country_id,
      customer_id: customer.id,
      assignment_id: a.id,
      address,
    });
  }
  if (delivery === "direct") {
    let { data: type } = await db()
      .from("ticket_types")
      .select("id")
      .eq("country_id", a.country_id ?? "")
      .eq("is_binding", true)
      .is("merchant_id", null)
      .maybeSingle();
    if (!type) {
      const { data: created } = await db()
        .from("ticket_types")
        .insert({
          country_id: a.country_id,
          name: "Account Binding",
          default_assignee: "phone_cs",
          window_days: 14,
          is_binding: true,
          sort: 5,
        })
        .select("id")
        .single();
      type = created;
    }
    const { data: ticket } = await db()
      .from("tickets")
      .insert({
        merchant_id: a.merchant_id,
        country_id: a.country_id,
        bank_account_id: a.bank_account_id,
        customer_id: customer.id,
        type_id: type?.id ?? null,
        description: `Account binding — ${a.ref ?? a.id}. Customer confirmed the agreement; walk them through binding.`,
        status: "assigned",
        assigned_to: "phone_cs",
        assigned_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (ticket) await db().from("account_assignments").update({ binding_ticket_id: ticket.id }).eq("id", id);
  }

  revalidatePath(back);
  redirect(`${back}?saved=confirmed`);
}

/**
 * The customer renews their own contract — always by hand, always against the
 * current T&C version, always inside the window. A closed window means only
 * we can renew, by agreement.
 */
export async function renewMyContract(formData: FormData): Promise<void> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");
  const id = String(formData.get("id") ?? "");
  const back = "/portal/contracts";
  const failTo = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  if (String(formData.get("accept") ?? "") !== "yes") failTo("Please tick that you accept the current terms");

  const { data } = await db()
    .from("contracts")
    .select("*")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!data) failTo("Contract not found");
  const k = data as import("@/modules/contracts/lib").Contract;
  if (k.status !== "active" || !k.ends_on) throw failTo("This contract cannot be renewed");

  const { renewalState, today } = await import("@/modules/contracts/lib");
  const state = renewalState(k, today());
  if (state !== "open") failTo(state === "closed" ? "The window has closed — contact support to renew" : "The renewal window isn't open yet");

  const { addMonths } = await import("@/modules/billing/engine");
  const months = Math.max(1, k.renewal_min_months || 1);
  const newEnd = addMonths(k.ends_on, months);

  const { currentTnc } = await import("@/modules/contracts/customer-policy");
  const tnc = await currentTnc(k.country_id ?? "", null);

  await db().from("contracts").update({ ends_on: newEnd, updated_at: new Date().toISOString() }).eq("id", id);
  await db().from("contract_renewals").insert({
    contract_id: id,
    months,
    old_ends_on: k.ends_on,
    new_ends_on: newEnd,
    tnc_id: tnc?.id ?? null,
    confirmed_by: cu.user.id,
    kind: "customer",
  });
  revalidatePath(back);
  redirect(`${back}?saved=renewed`);
}

/** The customer says the parcel arrived — then they test the account. */
export async function confirmReceived(formData: FormData): Promise<void> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/portal/agreements");

  await db()
    .from("shipments")
    .update({ received_at: new Date().toISOString() })
    .eq("assignment_id", id)
    .eq("customer_id", customer.id)
    .not("shipped_at", "is", null)
    .is("received_at", null)
    .is("cancelled_at", null);
  revalidatePath(back);
  redirect(`${back}?saved=received`);
}

/**
 * The customer's own acceptance that the account works — billing starts the
 * next day (never later than day 14). Recorded under their user id.
 */
export async function customerAccountTested(formData: FormData): Promise<void> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");
  const id = String(formData.get("id") ?? "");
  const back = "/portal/agreements";
  const failTo = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  const { data } = await db()
    .from("account_assignments")
    .select("id, status, delivery_method, customer_id")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!data) throw failTo("Not found");
  if (data.status !== "confirmed") failTo("This one isn't waiting for a test");
  if (data.delivery_method === "shipping") {
    const { data: ship } = await db()
      .from("shipments")
      .select("received_at")
      .eq("assignment_id", id)
      .is("cancelled_at", null)
      .maybeSingle();
    if (!ship?.received_at) failTo("Confirm you received the shipment first");
  }

  const { goLive } = await import("@/modules/contracts/customer-policy");
  const { addDays } = await import("@/modules/billing/engine");
  const today = new Date().toISOString().slice(0, 10);
  const err = await goLive(id, addDays(today, 1), cu.user.id);
  if (err) failTo(err);
  revalidatePath(back);
  redirect(`${back}?saved=tested`);
}


/** The customer changes their mind about delivery — allowed until it ships or goes live. */
export async function changeDelivery(formData: FormData): Promise<void> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");
  const id = String(formData.get("id") ?? "");
  const back = "/portal/agreements";
  const failTo = (m: string): never => redirect(`${back}?error=${encodeURIComponent(m)}`);

  const { data } = await db()
    .from("account_assignments")
    .select("id, customer_id")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!data) throw failTo("Not found");

  const to = String(formData.get("delivery_method") ?? "") === "shipping" ? "shipping" : "direct";
  let address: { name: string; phone: string; address: string } | null = null;
  if (to === "shipping") {
    const addrId = String(formData.get("address_id") ?? "");
    if (addrId) {
      const { data: saved } = await db()
        .from("customer_addresses")
        .select("name, phone, address")
        .eq("id", addrId)
        .eq("customer_id", customer.id)
        .maybeSingle();
      if (saved) address = saved as { name: string; phone: string; address: string };
    } else {
      const name = String(formData.get("addr_name") ?? "").trim();
      const phone = String(formData.get("addr_phone") ?? "").trim();
      const addr = String(formData.get("addr_address") ?? "").trim();
      if (name && phone && addr) {
        address = { name, phone, address: addr };
        await db().from("customer_addresses").insert({ customer_id: customer.id, ...address });
      }
    }
    if (!address) failTo("Shipping needs a delivery address");
  }

  const { switchDelivery } = await import("@/modules/contracts/customer-policy");
  const err = await switchDelivery(id, to, address, cu.user.id);
  if (err) failTo(err);
  revalidatePath(back);
  redirect(`${back}?saved=delivery`);
}
