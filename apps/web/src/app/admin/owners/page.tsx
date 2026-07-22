import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { OwnerStatusTag } from "@/components/status-tag";
import type { OwnerStatus } from "@/lib/types";

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  { value: "pending", label: "待审核" },
  { value: "draft", label: "资料收集中" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
];

export default async function AdminOwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; country?: string }>;
}) {
  await requireAdmin();
  const { status = "", country = "" } = await searchParams;

  const { data: countries } = await db().from("countries").select("id, name, flag").order("sort");

  let q = db()
    .from("owners")
    .select("*, merchant:merchants(name), country:countries(name, flag)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  if (country) q = q.eq("country_id", country);
  const { data: owners } = await q;

  const qs = (s: string, c: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (c) p.set("country", c);
    const str = p.toString();
    return str ? `?${str}` : "";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Owner 审核</h1>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/owners${qs(s.value, country)}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              status === s.value
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {s.label}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <Link
          href={`/admin/owners${qs(status, "")}`}
          className={`rounded-full border px-3 py-1 text-xs ${!country ? "border-accent bg-accent-soft text-accent-strong" : "border-border text-muted hover:text-foreground"}`}
        >
          所有国家
        </Link>
        {(countries ?? []).map((c: any) => (
          <Link
            key={c.id}
            href={`/admin/owners${qs(status, c.id)}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              country === c.id
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {c.flag} {c.name}
          </Link>
        ))}
      </div>

      <div className="card divide-y divide-border">
        {(owners ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">没有符合条件的 Owner。</p>}
        {(owners ?? []).map((o: any) => (
          <Link
            key={o.id}
            href={`/admin/owners/${o.id}`}
            className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-raised"
          >
            <div>
              <p className="text-sm font-medium">{o.full_name || "（未填写姓名）"}</p>
              <p className="text-xs text-muted">
                {o.country?.flag} {o.country?.name} · {o.merchant?.name} ·{" "}
                <span className="mono-num">{o.id_number || "—"}</span>
              </p>
            </div>
            <OwnerStatusTag status={o.status as OwnerStatus} />
          </Link>
        ))}
      </div>
    </div>
  );
}
