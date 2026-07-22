import Link from "next/link";
import { requirePlatformUser, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { OwnerStatusTag } from "@/components/status-tag";
import type { OwnerStatus } from "@/lib/types";

async function countRows(table: string, filter?: (q: any) => any): Promise<number> {
  let q = db().from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

// Platform dashboard. Module cards appear automatically for every enabled
// module the user can view — a new module only has to register its stats here.
export default async function AdminDashboard() {
  const cu = await requirePlatformUser();
  const toggles = await globalModuleToggles();
  const ownersOn = moduleEnabledFor("owners", toggles, null) && can(cu, "owners", "view");

  const stats: { label: string; value: number; href: string; warn?: boolean }[] = [];

  if (can(cu, "countries", "view")) {
    stats.push({ label: "Countries", value: await countRows("countries", (q: any) => q.eq("active", true)), href: "/admin/countries" });
  }
  if (can(cu, "merchants", "view")) {
    stats.push({ label: "Merchants", value: await countRows("merchants", (q: any) => q.eq("status", "active")), href: "/admin/countries" });
  }
  if (ownersOn) {
    const pending = await countRows("owners", (q: any) => q.eq("status", "pending"));
    stats.push({ label: "Owners", value: await countRows("owners"), href: "/admin/owners" });
    stats.push({ label: "Pending Review", value: pending, href: "/admin/owners?status=pending", warn: pending > 0 });
  }
  if (can(cu, "users", "view")) {
    stats.push({ label: "Users", value: await countRows("users", (q: any) => q.eq("active", true)), href: "/admin/users" });
  }

  const { data: recent } = ownersOn
    ? await db()
        .from("owners")
        .select("id, full_name, status, created_at, merchant:merchants(name), country:countries(name, flag)")
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [] };

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`card p-5 transition-colors hover:border-accent ${s.warn ? "glow-border" : ""}`}>
            <p className="text-sm text-muted">{s.label}</p>
            <p className={`mono-num mt-1 text-3xl font-semibold ${s.warn ? "text-warning" : ""}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      {ownersOn && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Recent Owners</h2>
          <div className="card divide-y divide-border">
            {(recent ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">No owner records yet.</p>}
            {(recent ?? []).map((o: any) => (
              <Link key={o.id} href={`/admin/owners/${o.id}`} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-raised">
                <div>
                  <p className="text-sm font-medium">{o.full_name || "(no name yet)"}</p>
                  <p className="text-xs text-muted">
                    {o.country?.flag} {o.country?.name} · {o.merchant?.name}
                  </p>
                </div>
                <OwnerStatusTag status={o.status as OwnerStatus} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
