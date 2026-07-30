import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { customerForUser } from "@/modules/customers/lib";
import { renewalState, today, type Contract } from "@/modules/contracts/lib";
import { fmtNum } from "@/lib/format";

// The customer's contracts: terms, dates, and where renewal stands.
export default async function PortalContractsPage() {
  const cu = (await getCurrentUser())!;
  const c = (await customerForUser(cu.user.id))!;

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
                <p className="text-[10px] uppercase tracking-wide text-muted">Deposit (agreed)</p>
                <p className="mono-num">{fmtNum(k.deposit)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted">Renewal</p>
                <p>
                  {renewal === "open" && <span className="text-warning">window open — contact us to renew</span>}
                  {renewal === "closed" && <span className="text-danger">window closed — by agreement only</span>}
                  {renewal === "not_yet" && k.ends_on && (
                    <span className="text-muted">opens {k.renewal_window_days} days before {k.ends_on}</span>
                  )}
                  {renewal === "none" && <span className="text-muted">—</span>}
                </p>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
