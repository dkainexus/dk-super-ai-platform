import Link from "next/link";
import { requireMerchantUser, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { OwnerStatusTag } from "@/components/status-tag";
import { HeroCard, StatCard, PALETTES, dailyCounts, cumulative } from "@/components/dash";
import { OWNER_STATUS_LABEL, type Owner, type OwnerStatus } from "@/lib/types";

// White label dashboard — crypto-styled cards, scoped to the merchant (and
// to the user's own records when scope=own).
export default async function MerchantDashboard() {
  const cu = await requireMerchantUser();
  const toggles = await globalModuleToggles();
  const ownersScope = can(cu, "owners", "view");
  const ownersOn = moduleEnabledFor("owners", toggles, cu.merchant) && ownersScope;
  const companiesScope = can(cu, "companies", "view");
  const companiesOn = moduleEnabledFor("companies", toggles, cu.merchant) && companiesScope;

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

  const counts: Record<OwnerStatus, number> = { draft: 0, pending: 0, approved: 0, rejected: 0, banned: 0 };
  for (const o of list) counts[o.status as OwnerStatus]++;
  const newDaily = dailyCounts(list.map((o) => o.created_at));
  const spark = cumulative(newDaily, Math.max(list.length - newDaily.reduce((a, b) => a + b, 0), 0));

  let companyCount = 0;
  let companiesRegistered = 0;
  if (companiesOn) {
    let q = db().from("companies").select("id, status, created_by").eq("merchant_id", cu.merchant.id);
    if (companiesScope === "own") q = q.eq("created_by", cu.user.id);
    const { data } = await q;
    companyCount = (data ?? []).length;
    companiesRegistered = (data ?? []).filter((c) => c.status === "registered").length;
  }

  const STATUS_CARDS: { status: OwnerStatus; icon: string; palette: keyof typeof PALETTES }[] = [
    { status: "draft", icon: "📥", palette: "cyan" },
    { status: "pending", icon: "⏳", palette: "amber" },
    { status: "approved", icon: "✅", palette: "green" },
    { status: "rejected", icon: "⛔", palette: "red" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {ownersOn ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <HeroCard
                label="Total Owners"
                value={list.length}
                sub="Cumulative — last 14 days"
                palette={PALETTES.cyan}
                spark={spark.length ? spark : [0, 0]}
                href="/m/owners"
              />
            </div>
            {companiesOn ? (
              <StatCard
                label="Companies"
                value={companyCount}
                sub={`${companiesRegistered} registered`}
                icon="🏢"
                palette={PALETTES.violet}
                href="/m/companies"
              />
            ) : (
              <StatCard
                label="Approved Owners"
                value={counts.approved}
                icon="✅"
                palette={PALETTES.green}
                href="/m/owners"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATUS_CARDS.map(({ status, icon, palette }) => (
              <StatCard
                key={status}
                label={OWNER_STATUS_LABEL[status]}
                value={counts[status]}
                icon={icon}
                palette={PALETTES[palette]}
                href="/m/owners"
              />
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
