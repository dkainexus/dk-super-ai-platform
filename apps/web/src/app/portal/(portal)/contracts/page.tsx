import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { renewalState, today, type Contract } from "@/modules/contracts/lib";
import { renewMyContract } from "@/app/portal/actions";
import { currentTnc } from "@/modules/contracts/customer-policy";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";

// The customer's contracts: terms, dates, and where renewal stands.
export default async function PortalContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;
  const { error, saved } = await searchParams;
  const tnc = c.country_id ? await currentTnc(c.country_id, null) : null;

  const { data } = await db()
    .from("contracts")
    .select("*, contract_accounts(count)")
    .eq("customer_id", c.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as (Contract & { contract_accounts: { count: number }[] })[];
  const day = today();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">My Contracts</h1>
        <p className="mt-1 text-sm text-muted">
          Renewal opens inside the window shown on each contract. Once the window closes, renewing is by
          agreement — contact support.
        </p>
      </div>

      <ErrorBanner message={error} />
      {saved === "renewed" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Renewed — your acceptance of the current terms is on record.
        </p>
      )}
      {rows.length === 0 && <p className="card px-5 py-6 text-sm text-muted">No contracts yet.</p>}

      {rows.map((k) => {
        const renewal = renewalState(k, day);
        return (
          <section key={k.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="mono-num text-sm font-semibold">{k.ref ?? "Contract"}</p>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] capitalize text-muted">
                {k.status}
              </span>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Term</p>
                <p className="mono-num">{k.starts_on} → {k.ends_on ?? "…"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Accounts</p>
                <p className="mono-num">{k.contract_accounts?.[0]?.count ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Insurance (agreed)</p>
                <p className="mono-num">{fmtNum(k.deposit)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Renewal</p>
                <p>
                  {renewal === "open" && <span className="text-warning">window open — renew below</span>}
                  {renewal === "closed" && <span className="text-danger">window closed — by agreement only</span>}
                  {renewal === "not_yet" && k.ends_on && (
                    <span className="text-muted">opens {k.renewal_window_days} days before {k.ends_on}</span>
                  )}
                  {renewal === "none" && <span className="text-muted">—</span>}
                </p>
              </div>
            </div>
            {renewal === "open" && k.status === "active" && (
              <form action={renewMyContract} className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                <input type="hidden" name="id" value={k.id} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="accept" value="yes" required />
                  <span>
                    I renew for {Math.max(1, k.renewal_min_months || 1)} more months and accept the current{" "}
                    {tnc ? `terms (v${tnc.version})` : "terms"}.
                  </span>
                </label>
                <ActionButton icon="check" tip="Extend your contract and record your acceptance" label="Renew" variant="success" />
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
