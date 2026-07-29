import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createMerchant } from "@/modules/merchants/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import { Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import type { Merchant } from "@/lib/types";

type Row = Merchant & { merchant_countries: { country: { name: string } | null }[] };

// The platform-wide white label registry: this is where a brand is created and
// its name, domain and status live. Day-to-day work happens inside a country.
export default async function WhiteLabelRegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("merchants", "view");
  const { error } = await searchParams;

  const [{ data: merchants }, { data: countries }] = await Promise.all([
    db().from("merchants").select("*, merchant_countries(country:countries(name))").order("name"),
    db().from("countries").select("id, name").eq("active", true).order("name"),
  ]);
  const rows = (merchants ?? []) as unknown as Row[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">White Labels</h1>
        <p className="mt-1 text-sm text-muted">
          Every brand on the platform. Create it here, then add it to the countries it operates in.
        </p>
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={rows.length} noun="white label" />

      <Table head={["White Label", "Domain", "Countries", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-6 text-sm text-muted">No white labels yet.</td>
          </tr>
        )}
        {rows.map((m) => (
          <tr key={m.id} className="transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5 font-medium">{m.name}</td>
            <td className="mono-num px-4 py-2.5 text-muted">{m.subdomain ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">
              {m.merchant_countries.map((c) => c.country?.name).filter(Boolean).join(", ") || "none"}
            </td>
            <td className="px-4 py-2.5">
              <ActiveTag active={m.status === "active"} on="Active" off="Suspended" />
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/merchants/${m.id}`} tip={`Open ${m.name}`} />
            </td>
          </tr>
        ))}
      </Table>

      {can(cu, "merchants", "add") && (
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Create White Label</h2>
          <p className="mb-4 text-xs text-muted">
            Name, domain and the first login account. Countries are assigned from inside each country.
          </p>
          <form action={createMerchant} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">White Label Name</label>
                <input name="name" className="input" required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Subdomain (optional, lowercase a-z 0-9 -)</label>
                <input name="subdomain" placeholder="brand-a" className="input mono-num" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Login Username</label>
                <input name="username" autoComplete="off" className="input mono-num" required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Initial Password (changed at first login)</label>
                <input name="password" type="text" autoComplete="off" className="input mono-num" required />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">Starts in country</label>
                <select name="first_country" className="input" required>
                  <option value="">— Select a country —</option>
                  {((countries ?? []) as { id: string; name: string }[]).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <SubmitButton label="Create White Label" />
          </form>
        </section>
      )}

      <p className="text-xs text-muted">
        Working inside a country? Its white labels are under{" "}
        <Link href="/admin/merchants" className="text-accent-strong hover:underline">White Labels</Link> there.
      </p>
    </div>
  );
}
