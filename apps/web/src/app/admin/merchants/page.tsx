import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { addMerchantToCountry } from "@/modules/merchants/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton } from "@/components/action-buttons";
import { Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import type { Merchant } from "@/lib/types";

// White labels operating in the country you are working in, with how much each
// one is carrying. Brands themselves are created in the platform console.
export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("merchants", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data: links } = await db()
    .from("merchant_countries")
    .select("merchant:merchants(*)")
    .eq("country_id", active.id);
  const merchants = ((links ?? []) as unknown as { merchant: Merchant | null }[])
    .map((l) => l.merchant)
    .filter(Boolean) as Merchant[];
  merchants.sort((a, b) => a.name.localeCompare(b.name));
  const ids = merchants.map((m) => m.id);

  const [{ data: owners }, { data: companies }, { data: accounts }, { data: allMerchants }] = await Promise.all([
    ids.length
      ? db().from("owners").select("merchant_id").eq("country_id", active.id).in("merchant_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db().from("companies").select("merchant_id").eq("country_id", active.id).in("merchant_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? db().from("bank_accounts").select("merchant_id").eq("country_id", active.id).in("merchant_id", ids)
      : Promise.resolve({ data: [] }),
    db().from("merchants").select("id, name").eq("status", "active").order("name"),
  ]);

  const tally = (rows: { merchant_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const r of rows ?? []) map.set(r.merchant_id, (map.get(r.merchant_id) ?? 0) + 1);
    return map;
  };
  const ownerCount = tally(owners as { merchant_id: string }[] | null);
  const companyCount = tally(companies as { merchant_id: string }[] | null);
  const accountCount = tally(accounts as { merchant_id: string }[] | null);

  const available = ((allMerchants ?? []) as { id: string; name: string }[]).filter((m) => !ids.includes(m.id));
  const canEdit = can(cu, "merchants", "edit");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">White Labels</h1>
        <p className="mt-1 text-sm text-muted">Brands operating in {active.name}.</p>
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={merchants.length} noun="white label" />

      <Table head={["White Label", "Owners", "Companies", "Bank Accounts", "Status", ""]}>
        {merchants.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-sm text-muted">
              No white labels in {active.name} yet — add one below.
            </td>
          </tr>
        )}
        {merchants.map((m) => (
          <tr key={m.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5 font-medium">{m.name}</td>
            <td className="mono-num px-4 py-2.5">{ownerCount.get(m.id) ?? 0}</td>
            <td className="mono-num px-4 py-2.5">{companyCount.get(m.id) ?? 0}</td>
            <td className="mono-num px-4 py-2.5">{accountCount.get(m.id) ?? 0}</td>
            <td className="px-4 py-2.5">
              <ActiveTag active={m.status === "active"} on="Active" off="Suspended" />
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/merchants/${m.id}`} tip={`Open ${m.name}`} />
            </td>
          </tr>
        ))}
      </Table>

      {canEdit && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Add a white label to {active.name}</h2>
          <p className="mb-4 text-xs text-muted">
            Pick a brand that already exists — new brands are created in the platform console.
          </p>
          {available.length > 0 ? (
            <form action={addMerchantToCountry} className="flex max-w-md items-end gap-3">
              <input type="hidden" name="country_id" value={active.id} />
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted">White Label</label>
                <select name="merchant_id" className="input" required>
                  <option value="">— Select —</option>
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <ActionButton icon="plus" tip={`Add this white label to ${active.name}`} label="Add" variant="primary" />
            </form>
          ) : (
            <p className="text-xs text-muted">
              Every white label is already here. Create a new one in the{" "}
              <Link href="/admin/white-labels" className="text-accent-strong hover:underline">platform console</Link>.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
