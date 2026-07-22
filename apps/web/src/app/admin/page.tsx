import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { OwnerStatusTag } from "@/components/status-tag";
import type { OwnerStatus } from "@/lib/types";

async function countRows(table: string, filter?: (q: any) => any): Promise<number> {
  let q = db().from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

export default async function AdminHome() {
  await requireAdmin();

  const [countries, merchants, owners, pending] = await Promise.all([
    countRows("countries", (q) => q.eq("active", true)),
    countRows("merchants", (q) => q.eq("status", "active")),
    countRows("owners"),
    countRows("owners", (q) => q.eq("status", "pending")),
  ]);

  const { data: recent } = await db()
    .from("owners")
    .select("id, full_name, status, created_at, merchant:merchants(name), country:countries(name, flag)")
    .order("created_at", { ascending: false })
    .limit(8);

  const stats = [
    { label: "国家", value: countries, href: "/admin/countries" },
    { label: "商家", value: merchants, href: "/admin/countries" },
    { label: "Owner 总数", value: owners, href: "/admin/owners" },
    { label: "待审核", value: pending, href: "/admin/owners?status=pending", warn: pending > 0 },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">总览</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`card p-5 transition-colors hover:border-accent ${s.warn ? "glow-border" : ""}`}>
            <p className="text-sm text-muted">{s.label}</p>
            <p className={`mono-num mt-1 text-3xl font-semibold ${s.warn ? "text-warning" : ""}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">最近的 Owner</h2>
        <div className="card divide-y divide-border">
          {(recent ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">还没有 Owner 记录</p>
          )}
          {(recent ?? []).map((o: any) => (
            <Link key={o.id} href={`/admin/owners/${o.id}`} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-raised">
              <div>
                <p className="text-sm font-medium">{o.full_name || "（未填写姓名）"}</p>
                <p className="text-xs text-muted">
                  {o.country?.flag} {o.country?.name} · {o.merchant?.name}
                </p>
              </div>
              <OwnerStatusTag status={o.status as OwnerStatus} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
