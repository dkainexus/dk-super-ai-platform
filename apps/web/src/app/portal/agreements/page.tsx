import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { assignmentsFor, assignmentDeadline } from "@/modules/contracts/customer-policy";
import { confirmAssignment, confirmReceived } from "@/app/portal/actions";
import { logoutAction } from "@/app/actions/auth";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";

const MODE_TEXT: Record<string, string> = {
  rent: "Fixed monthly price",
  turnover: "Share of turnover only",
  rent_plus_turnover: "Monthly price plus a share of turnover",
  max: "Monthly price, or the turnover share when higher",
};

// The reading room: every agreement in full — the fixed terms and this
// account's conditions — confirmed here before the portal opens up.
export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; view?: string }>;
}) {
  const cu = await getCurrentUser();
  if (!cu) redirect("/portal/login");
  const customer = await customerForUser(cu.user.id);
  if (!customer) redirect("/portal/login");
  const { error, saved, view } = await searchParams;

  const all = await assignmentsFor({ customerId: customer.id });
  const pending = all.filter((a) => a.status === "awaiting_confirmation");
  const done = all.filter((a) => a.status === "confirmed" || a.status === "live");

  const tncIds = [...new Set(all.map((a) => a.tnc_id).filter(Boolean))] as string[];
  const { data: tncs } = tncIds.length
    ? await db().from("terms_documents").select("id, version, title, body, created_at").in("id", tncIds)
    : { data: [] };
  const tncById = new Map(
    ((tncs ?? []) as { id: string; version: number; title: string; body: string; created_at: string }[]).map((t) => [t.id, t])
  );

  const { data: addresses } = await db()
    .from("customer_addresses")
    .select("id, name, phone, address")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });
  const addressBook = (addresses ?? []) as { id: string; name: string; phone: string; address: string }[];

  const viewingTnc = view ? tncById.get(view) ?? null : null;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-5 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">My Agreements</h1>
          <p className="mt-1 text-sm text-muted">
            {pending.length > 0
              ? "Read each agreement in full and confirm it — the portal opens once everything is confirmed."
              : "Everything you have agreed to, with the exact version you accepted."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending.length === 0 && (
            <Link href="/portal" className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground">
              ← Portal
            </Link>
          )}
          <form action={logoutAction}>
            <button className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <ErrorBanner message={error} />
      {saved === "received" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Noted — our support will contact you to test the account. Billing starts the day after it works.
        </p>
      )}
      {saved === "confirmed" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Confirmed. {pending.length > 0 ? "One more to go below." : "You're all set."}
        </p>
      )}

      {pending.map((a) => {
        const c = a.conditions as {
          bank?: string; mode?: string; rent?: number; turnover_pct?: number | null; setup_fee?: number;
          deposit?: number; contract_months?: number | null; renewal_months?: number | null;
        };
        const tnc = a.tnc_id ? tncById.get(a.tnc_id) : null;
        return (
          <section key={a.id} className="card space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">
                {a.bank_account?.bank?.name ?? "?"}{" "}
                <span className="mono-num text-sm text-muted">{a.bank_account?.account_no}</span>
              </h2>
              <p className="mono-num mt-0.5 text-xs text-muted">{a.ref ?? ""} · assigned {a.assigned_on}</p>
            </div>

            <div className="rounded-lg bg-surface-raised p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Your Conditions</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>Pricing: <span className="font-medium">{MODE_TEXT[c.mode ?? "max"]}</span></p>
                {c.mode !== "turnover" && <p>Monthly price: <span className="mono-num font-medium">{fmtNum(c.rent ?? 0)}</span></p>}
                {c.turnover_pct != null && <p>Turnover share: <span className="mono-num font-medium">{c.turnover_pct}%</span></p>}
                <p>Setup fee (once): <span className="mono-num font-medium">{fmtNum(c.setup_fee ?? 0)}</span></p>
                <p>Insurance (written, not collected): <span className="mono-num font-medium">{fmtNum(c.deposit ?? 0)}</span></p>
                <p>Minimum term: <span className="mono-num font-medium">{c.contract_months ?? "—"} months</span></p>
                <p>Renewal: <span className="mono-num font-medium">{c.renewal_months ?? "—"} months</span></p>
                <p>
                  Delivery: <span className="font-medium">{a.delivery_method === "shipping" ? "Shipping" : "Direct binding with our support"}</span>
                </p>
              </div>
              <p className="mt-2 text-xs text-muted">
                Billing starts the day after binding completes — and no later than {assignmentDeadline(a.assigned_on)}.
              </p>
            </div>

            {tnc && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  {tnc.title} — version {tnc.version}
                </h3>
                <div className="max-h-80 overflow-y-auto rounded-lg border border-border p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted">{tnc.body}</pre>
                </div>
                <a
                  href={`/portal/agreements/${a.id}/pdf`}
                  className="mt-2 inline-block text-xs text-accent-strong hover:underline"
                >
                  Download this agreement as PDF
                </a>
              </div>
            )}

            <form action={confirmAssignment} className="space-y-3 border-t border-border pt-4">
              <input type="hidden" name="id" value={a.id} />
              {a.delivery_method === "shipping" && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Delivery Address</h3>
                  {addressBook.length > 0 && (
                    <select name="address_id" className="input" defaultValue="">
                      <option value="">— New address (fill below) —</option>
                      {addressBook.map((ad) => (
                        <option key={ad.id} value={ad.id}>
                          {ad.name} · {ad.phone} · {ad.address}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input name="addr_name" className="input" placeholder="Recipient name" />
                    <input name="addr_phone" className="input" placeholder="Phone" />
                    <input name="addr_address" className="input sm:col-span-2" placeholder="Full address" />
                  </div>
                  <p className="text-xs text-muted">Pick a saved address or enter a new one — it is kept for next time.</p>
                </div>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="accept" value="yes" className="mt-1" required />
                <span>
                  I have read the conditions above and {tnc ? `${tnc.title} v${tnc.version}` : "the terms"} in full,
                  and I accept them.
                </span>
              </label>
              <ActionButton icon="check" tip="Record your acceptance of exactly this version" label="Confirm Agreement" variant="success" />
            </form>
          </section>
        );
      })}

      {done.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Confirmed Agreements</h2>
          <div className="divide-y divide-border">
            {done.map((a) => {
              const tnc = a.tnc_id ? tncById.get(a.tnc_id) : null;
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    {a.bank_account?.bank?.name ?? "?"}{" "}
                    <span className="mono-num text-xs text-muted">{a.bank_account?.account_no}</span>
                    <span className="ml-2 text-xs text-muted">
                      confirmed {a.confirmed_at ? new Date(a.confirmed_at).toLocaleDateString() : "—"}
                      {tnc ? ` · terms v${tnc.version}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {a.status === "confirmed" && a.delivery_method === "shipping" && !a.shipped_at && (
                      <span className="text-xs text-muted">preparing shipment</span>
                    )}
                    {a.status === "confirmed" && a.shipped_at && (
                      <span className="mono-num text-xs text-muted">
                        {a.courier} · {a.tracking_no}
                      </span>
                    )}
                    {a.status === "confirmed" && a.shipped_at && !a.received_at && (
                      <form action={confirmReceived}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="rounded-md border border-accent/50 px-2.5 py-1 text-xs text-accent-strong hover:bg-accent-soft">
                          I&apos;ve received it
                        </button>
                      </form>
                    )}
                    {a.status === "confirmed" && a.received_at && (
                      <span className="text-xs text-success">received — testing next</span>
                    )}
                    {tnc && (
                      <Link href={`/portal/agreements?view=${tnc.id}`} className="text-xs text-muted hover:text-foreground">
                        View terms
                      </Link>
                    )}
                    <a href={`/portal/agreements/${a.id}/pdf`} className="text-xs text-accent-strong hover:underline">
                      Download PDF
                    </a>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {viewingTnc && (
        <section className="card p-5">
          <h2 className="mb-2 text-sm font-semibold">
            {viewingTnc.title} — version {viewingTnc.version}
            <span className="ml-2 text-xs font-normal text-muted">
              published {new Date(viewingTnc.created_at).toLocaleDateString()}
            </span>
          </h2>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted">{viewingTnc.body}</pre>
        </section>
      )}
    </main>
  );
}
