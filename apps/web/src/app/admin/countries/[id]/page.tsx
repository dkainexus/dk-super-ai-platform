import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createMerchant } from "@/app/actions/cms";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SubmitButton } from "@/components/action-buttons";
import type { Country, Merchant } from "@/lib/types";

export default async function CountryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("countries", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const { data: country } = await db().from("countries").select("*").eq("id", id).maybeSingle();
  if (!country) notFound();
  const c = country as Country;

  const { data: merchants } = await db()
    .from("merchants")
    .select("*, users(count), owners(count)")
    .eq("country_id", id)
    .order("created_at");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/countries" className="text-xs text-muted hover:text-foreground">
          ← Countries
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {c.flag || "🌐"} {c.name} <span className="mono-num text-sm text-muted">{c.code}</span>
        </h1>
      </div>
      <ErrorBanner message={error} />

      {/* ---------- Merchants ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Merchants</h2>
        <div className="card divide-y divide-border">
          {(merchants ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">No merchants in this country yet.</p>
          )}
          {(merchants ?? []).map(
            (m: Merchant & { users: { count: number }[]; owners: { count: number }[] }) => (
              <Link
                key={m.id}
                href={`/admin/merchants/${m.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-raised"
              >
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted">
                    {m.subdomain ? `${m.subdomain}.***` : "no subdomain"} · {m.users?.[0]?.count ?? 0} account(s) ·{" "}
                    {m.owners?.[0]?.count ?? 0} owner(s)
                  </p>
                </div>
                <ActiveTag active={m.status === "active"} on="Active" off="Suspended" />
              </Link>
            )
          )}
        </div>

        <div className="card mt-4 p-5">
          <h3 className="mb-4 text-sm font-semibold">Create Merchant + Login Account</h3>
          <form action={createMerchant} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="country_id" value={c.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Merchant Name</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Subdomain (optional, lowercase a-z 0-9 -)</label>
              <input name="subdomain" placeholder="merchant-a" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Login Username</label>
              <input name="username" autoComplete="off" className="input mono-num" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Initial Password (must be changed at first login)</label>
              <input name="password" type="text" autoComplete="off" className="input mono-num" required />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton label="Create Merchant" />
            </div>
          </form>
        </div>
      </section>

      {/* Custom fields now live under Owners module settings */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Owner Custom Fields</h2>
        <Link
          href={`/admin/settings/owners?country=${c.id}`}
          className="inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          Manage {c.name} custom fields in Owners Module Settings →
        </Link>
      </section>
    </div>
  );
}
