import Link from "next/link";
import { requireMerchantUser, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { OwnerStatusTag } from "@/components/status-tag";
import { OWNER_STATUS_LABEL, type Owner, type OwnerStatus } from "@/lib/types";

// Merchant dashboard — module cards appear for every enabled module the user
// can view, scoped to their merchant (and to their own records when scope=own).
export default async function MerchantDashboard() {
  const cu = await requireMerchantUser();
  const toggles = await globalModuleToggles();
  const ownersScope = can(cu, "owners", "view");
  const ownersOn = moduleEnabledFor("owners", toggles, cu.merchant) && ownersScope;

  let list: Pick<Owner, "id" | "full_name" | "status" | "created_at">[] = [];
  if (ownersOn) {
    let q = db()
      .from("owners")
      .select("id, full_name, status, created_at, created_by")
      .eq("merchant_id", cu.merchant.id)
      .order("created_at", { ascending: false });
    if (ownersScope === "own") q = q.eq("created_by", cu.user.id);
    const { data } = await q;
    list = (data ?? []) as typeof list;
  }

  const counts: Record<OwnerStatus, number> = { draft: 0, pending: 0, approved: 0, rejected: 0 };
  for (const o of list) counts[o.status as OwnerStatus]++;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {ownersOn ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(Object.keys(counts) as OwnerStatus[]).map((s) => (
              <Link key={s} href="/m/owners" className="card p-5 transition-colors hover:border-accent">
                <p className="text-sm text-muted">{OWNER_STATUS_LABEL[s]}</p>
                <p className="mono-num mt-1 text-3xl font-semibold">{counts[s]}</p>
              </Link>
            ))}
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Recent Owners</h2>
              {can(cu, "owners", "add") && (
                <Link href="/m/owners/new" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong">
                  + New Owner
                </Link>
              )}
            </div>
            <div className="card divide-y divide-border">
              {list.length === 0 && <p className="px-5 py-6 text-sm text-muted">No owners yet.</p>}
              {list.slice(0, 8).map((o) => (
                <Link key={o.id} href={`/m/owners/${o.id}`} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-raised">
                  <p className="text-sm font-medium">{o.full_name || "(no name yet)"}</p>
                  <OwnerStatusTag status={o.status as OwnerStatus} />
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-muted">No modules available. Contact your administrator.</p>
      )}
    </div>
  );
}
