import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { buildAgreementPdf } from "@/modules/contracts/agreement-pdf";

// The customer's own copy of an agreement, as a file they can keep.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cu = await getCurrentUser();
  if (!cu) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const customer = await customerForUser(cu.user.id);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data } = await db()
    .from("account_assignments")
    .select(
      "*, bank_account:bank_accounts(account_no, bank:banks(name)), tnc:terms_documents(version, title, body)"
    )
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const a = data as unknown as {
    ref: string | null;
    assigned_on: string;
    confirmed_at: string | null;
    status: string;
    live_on: string | null;
    delivery_method: string;
    conditions: Record<string, unknown>;
    bank_account: { account_no: string; bank: { name: string } | null } | null;
    tnc: { version: number; title: string; body: string } | null;
  };

  const pdf = await buildAgreementPdf({
    ref: a.ref ?? id,
    customerName: customer.name,
    bankName: a.bank_account?.bank?.name ?? "?",
    accountNo: a.bank_account?.account_no ?? "?",
    assignedOn: a.assigned_on,
    confirmedAt: a.confirmed_at ? new Date(a.confirmed_at).toISOString().replace("T", " ").slice(0, 16) : null,
    status: a.status,
    liveOn: a.live_on,
    delivery: a.delivery_method,
    conditions: a.conditions as never,
    tncTitle: a.tnc?.title ?? "Terms & Conditions",
    tncVersion: a.tnc?.version ?? null,
    tncBody: a.tnc?.body ?? "",
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="agreement-${(a.ref ?? id).replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
    },
  });
}
