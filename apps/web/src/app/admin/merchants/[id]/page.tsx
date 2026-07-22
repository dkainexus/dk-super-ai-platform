import Link from "next/link";
import { notFound } from "next/navigation";
/* eslint-disable @next/next/no-img-element */
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import {
  updateMerchantByAdmin,
  createMerchantUser,
  resetMerchantUserPassword,
  toggleMerchantUser,
  uploadMerchantLogoByAdmin,
} from "@/modules/merchants/actions";
import { saveMerchantModules } from "@/app/actions/settings";
import { saveMerchantCountries } from "@/modules/merchants/actions";
import { merchantCountries } from "@/modules/merchants/lib";
import { UserCountriesCard } from "@/modules/merchants/components/user-countries";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag, OwnerStatusTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { TOGGLABLE_MODULES } from "@/modules/registry";
import type { Country, Merchant, Owner, OwnerStatus, Role, User } from "@/lib/types";

export default async function MerchantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("merchants", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const { data } = await db().from("merchants").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const m = data as Merchant;
  const [enabledCountries, { data: allCountries }] = await Promise.all([
    merchantCountries(m.id),
    db().from("countries").select("*").order("sort").order("name"),
  ]);
  const enabledIds = new Set(enabledCountries.map((c) => c.id));

  const [{ data: users }, { data: owners }, logoUrl] = await Promise.all([
    db().from("users").select("*, role:roles(*)").eq("merchant_id", id).order("created_at"),
    db().from("owners").select("*").eq("merchant_id", id).order("created_at", { ascending: false }),
    signedUrl(ASSETS_BUCKET, m.logo_path),
  ]);
  const disabled = (m.disabled_modules ?? []) as string[];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/merchants" className="text-xs text-muted hover:text-foreground">
          ← White Labels
        </Link>
        <div className="mt-1 flex items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />}
          <h1 className="text-xl font-semibold">{m.name}</h1>
          <ActiveTag active={m.status === "active"} on="Active" off="Suspended" />
        </div>
        <p className="mt-1 text-sm text-muted">{enabledCountries.map((c) => `${c.flag || "🌐"} ${c.name}`).join(" · ")}</p>
      </div>
      <ErrorBanner message={error} />

      {/* Merchant info */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">White Label Info</h2>
        <form action={updateMerchantByAdmin} className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <input type="hidden" name="id" value={m.id} />
          <div>
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input name="name" defaultValue={m.name} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Subdomain</label>
            <input name="subdomain" defaultValue={m.subdomain ?? ""} className="input mono-num" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Status</label>
            <select name="status" defaultValue={m.status} className="input">
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <SaveButton tip="Save merchant info" />
          </div>
        </form>
        <form action={uploadMerchantLogoByAdmin} className="mt-4 flex items-end gap-3 border-t border-border pt-4">
          <input type="hidden" name="id" value={m.id} />
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Logo (≤2MB)</label>
            <input name="logo" type="file" accept="image/*" className="input" required />
          </div>
          <ActionButton icon="upload" tip="Upload this logo" label="Upload" />
        </form>
      </section>

      {/* Per-merchant modules */}
      <UserCountriesCard
        users={((users ?? []) as (User & { role: Role | null })[]).map((u) => ({ id: u.id, username: u.username, name: u.name }))}
        countries={enabledCountries}
        back={`/admin/merchants/${m.id}`}
      />

      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Countries</h2>
        <p className="mb-4 text-xs text-muted">
          Which countries this white label operates in. Owners and companies always pick their country at creation —
          a country with existing data cannot be removed.
        </p>
        <form action={saveMerchantCountries} className="space-y-3">
          <input type="hidden" name="merchant_id" value={m.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            {((allCountries ?? []) as Country[]).map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5 transition-colors hover:border-accent">
                <span className="text-sm">
                  {c.flag || "🌐"} {c.name} <span className="mono-num text-xs text-muted">{c.code}</span>
                </span>
                <input type="checkbox" name={`mc_${c.id}`} defaultChecked={enabledIds.has(c.id)} className="h-4 w-4" />
              </label>
            ))}
          </div>
          <SaveButton tip="Save the countries this white label operates in" />
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Modules</h2>
        <p className="mb-4 text-xs text-muted">
          Switch modules off for this merchant only. Globally disabled modules stay off regardless.
        </p>
        <form action={saveMerchantModules} className="space-y-3">
          <input type="hidden" name="merchant_id" value={m.id} />
          {TOGGLABLE_MODULES.map((mod) => (
            <label key={mod.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <span>
                <span className="block text-sm font-medium">{mod.name}</span>
                <span className="block text-xs text-muted">{mod.description}</span>
              </span>
              <input type="checkbox" name={`mod_${mod.key}`} defaultChecked={!disabled.includes(mod.key)} className="h-4 w-4" />
            </label>
          ))}
          <SaveButton tip="Save module overrides for this merchant" />
        </form>
      </section>

      {/* Login accounts */}
      {can(cu, "users", "view") && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Login Accounts</h2>
          <div className="space-y-3">
            {((users ?? []) as (User & { role: Role | null })[]).map((u) => (
              <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="mono-num text-sm font-medium">{u.username}</p>
                  <p className="text-xs text-muted">
                    {u.name || "—"} · {u.role?.name ?? "No role"}
                    {u.must_change_password && " · first login pending"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ActiveTag active={u.active} />
                  <form action={toggleMerchantUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="merchant_id" value={m.id} />
                    <input type="hidden" name="active" value={String(!u.active)} />
                    <ActionButton icon="power" tip={u.active ? "Deactivate this account" : "Activate this account"} />
                  </form>
                  <form action={resetMerchantUserPassword} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="merchant_id" value={m.id} />
                    <input name="password" type="text" placeholder="New password" autoComplete="off" className="input w-28 py-1 text-xs" required />
                    <ActionButton icon="key" tip="Reset password (forces change at next login)" />
                  </form>
                </div>
              </div>
            ))}
          </div>

          <div className="card mt-4 p-5">
            <h3 className="mb-4 text-sm font-semibold">Add Login Account</h3>
            <form action={createMerchantUser} className="grid gap-4 sm:grid-cols-4 sm:items-end">
              <input type="hidden" name="merchant_id" value={m.id} />
              <div>
                <label className="mb-1 block text-xs text-muted">Username</label>
                <input name="username" autoComplete="off" className="input mono-num" required />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Display Name (optional)</label>
                <input name="name" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Initial Password</label>
                <input name="password" type="text" autoComplete="off" className="input mono-num" required />
              </div>
              <ActionButton icon="plus" tip="Create account with the White Label Owner role" label="Create" variant="primary" />
            </form>
          </div>
        </section>
      )}

      {/* Owners */}
      {can(cu, "owners", "view") && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Owners ({(owners ?? []).length})
          </h2>
          <div className="card divide-y divide-border">
            {(owners ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">No owners yet.</p>}
            {((owners ?? []) as Owner[]).map((o) => (
              <Link key={o.id} href={`/admin/owners/${o.id}`} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-raised">
                <div>
                  <p className="text-sm font-medium">{o.full_name || "(no name yet)"}</p>
                  <p className="mono-num text-xs text-muted">{o.id_number || "—"}</p>
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
