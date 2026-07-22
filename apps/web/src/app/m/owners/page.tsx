import Link from "next/link";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { OwnerStatusTag } from "@/components/status-tag";
import type { Owner, OwnerStatus } from "@/lib/types";

export default async function MerchantOwnersPage() {
  const cu = await requireMerchantUser();
  const scope = (await requirePerm("owners", "view")).scope;
  const merchant = cu.merchant;

  let q = db()
    .from("owners")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });
  if (scope === "own") q = q.eq("created_by", cu.user.id);
  const { data: owners } = await q;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Owners</h1>
        <Link
          href="/m/owners/new"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
        >
          + New Owner
        </Link>
      </div>

      <div className="card divide-y divide-border">
        {(owners ?? []).length === 0 && (
          <p className="px-5 py-6 text-sm text-muted">No owners yet — use the button above to add one.</p>
        )}
        {((owners ?? []) as Owner[]).map((o) => (
          <Link
            key={o.id}
            href={`/m/owners/${o.id}`}
            className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-raised"
          >
            <div>
              <p className="text-sm font-medium">{o.full_name || "(no name yet)"}</p>
              <p className="mono-num text-xs text-muted">{o.id_number || "—"}</p>
            </div>
            <OwnerStatusTag status={o.status as OwnerStatus} />
          </Link>
        ))}
      </div>
    </div>
  );
}
