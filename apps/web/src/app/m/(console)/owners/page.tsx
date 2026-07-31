import Link from "next/link";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { activeCountry } from "@/modules/merchants/lib";
import { agentForUser } from "@/modules/agents/lib";
import { OwnerStatusTag } from "@/components/status-tag";
import { Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import type { Owner, OwnerStatus } from "@/lib/types";

export default async function MerchantOwnersPage() {
  const cu = await requireMerchantUser();
  const scope = (await requirePerm("owners", "view")).scope;
  const merchant = cu.merchant;
  const { active } = await activeCountry(cu);
  // Only an agent enters owners — the white label itself just watches.
  const selfAgent = await agentForUser(cu.user.id);

  let q = db()
    .from("owners")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });
  if (active) q = q.eq("country_id", active.id);
  if (scope === "own") q = q.eq("created_by", cu.user.id);
  const { data: owners } = await q;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Owners{active ? ` — ${active.flag || ""} ${active.name}` : ""}</h1>
        {selfAgent && (
          <Link
            href="/m/owners/new"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-accent-strong"
          >
            + New Owner
          </Link>
        )}
      </div>

      <TableToolbar count={(owners ?? []).length} noun="owner" />
      <Table head={["ID", "Name", "ID Number", "Phone", "Added", "Status", ""]}>
        {(owners ?? []).length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-sm text-muted">No owners yet.</td>
          </tr>
        )}
        {((owners ?? []) as Owner[]).map((o) => (
          <tr key={o.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{o.ref ?? "—"}</td>
            <td className="px-4 py-2.5 font-medium">{o.full_name || "(no name yet)"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{o.id_number || "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{o.phone || "—"}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{o.created_at?.slice(0, 10)}</td>
            <td className="px-4 py-2.5">
              <OwnerStatusTag status={o.status as OwnerStatus} />
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/m/owners/${o.id}`} tip="Open this owner" />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
