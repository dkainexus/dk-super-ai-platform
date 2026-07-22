import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { OwnerStatusTag } from "@/components/status-tag";
import { OWNER_STATUS_LABEL, type Owner, type OwnerStatus } from "@/lib/types";

export default async function MerchantHome() {
  const { merchant } = await requireMerchant();

  const { data: owners } = await db()
    .from("owners")
    .select("id, full_name, status, created_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  const list = (owners ?? []) as Pick<Owner, "id" | "full_name" | "status" | "created_at">[];
  const counts: Record<OwnerStatus, number> = { draft: 0, pending: 0, approved: 0, rejected: 0 };
  for (const o of list) counts[o.status as OwnerStatus]++;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">总览</h1>

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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">最近的 Owner</h2>
          <Link
            href="/m/owners/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + 新增 Owner
          </Link>
        </div>
        <div className="card divide-y divide-border">
          {list.length === 0 && <p className="px-5 py-6 text-sm text-muted">还没有 Owner，点右上角新增。</p>}
          {list.slice(0, 8).map((o) => (
            <Link
              key={o.id}
              href={`/m/owners/${o.id}`}
              className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-raised"
            >
              <p className="text-sm font-medium">{o.full_name || "（未填写姓名）"}</p>
              <OwnerStatusTag status={o.status as OwnerStatus} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
