import Link from "next/link";
import { requireMerchant } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { OwnerStatusTag } from "@/components/status-tag";
import type { Owner, OwnerStatus } from "@/lib/types";

export default async function MerchantOwnersPage() {
  const { merchant } = await requireMerchant();

  const { data: owners } = await db()
    .from("owners")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Owner 管理</h1>
        <Link
          href="/m/owners/new"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
        >
          + 新增 Owner
        </Link>
      </div>

      <div className="card divide-y divide-border">
        {(owners ?? []).length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">还没有 Owner，点右上角新增。</p>
        )}
        {((owners ?? []) as Owner[]).map((o) => (
          <Link
            key={o.id}
            href={`/m/owners/${o.id}`}
            className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-raised"
          >
            <div>
              <p className="text-sm font-medium">{o.full_name || "（未填写姓名）"}</p>
              <p className="mono-num text-xs text-muted">{o.id_number || "—"}</p>
            </div>
            <OwnerStatusTag status={o.status as OwnerStatus} />
          </Link>
        ))}
      </div>
    </div>
  );
}
