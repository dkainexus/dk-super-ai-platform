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
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { TOGGLABLE_MODULES } from "@/modules/registry";
import type { Country, Merchant, Role, User } from "@/lib/types";

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

  const canEdit = Boolean(can(cu, "merchants", "edit"));
  const [{ data: users }, logoUrl] = await Promise.all([
    db().from("users").select("*, role:roles(*)").eq("merchant_id", id).order("created_at"),
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

      {/* Countries */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Countries</h2>
        <p className="mb-4 text-xs text-muted">
          Where this white label operates. A country with owners or companies in it cannot be removed.
        </p>
        <form action={saveMerchantCountries} className="space-y-3">
          <input type="hidden" name="merchant_id" value={m.id} />
          <div className="flex flex-wrap gap-3">
            {((allCountries ?? []) as Country[]).map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="checkbox" name={`mc_${c.id}`} defaultChecked={enabledIds.has(c.id)} className="h-4 w-4" disabled={!canEdit} />
                {c.flag || "🌐"} {c.name}
              </label>
            ))}
          </div>
          {canEdit && <SaveButton tip="Save the countries this white label operates in" />}
        </form>
      </section>

      {/* Accounts */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Accounts</h2>
        <p className="mb-4 text-xs text-muted">
          The white label&apos;s sign-ins. Resetting a password forces them to choose a new one at next login.
        </p>
        <div className="space-y-3">
          {((users ?? []) as (User & { role: Role | null })[]).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {u.name || u.username} <span className="mono-num font-normal text-muted">{u.username}</span>
                </p>
                <p className="text-xs text-muted">{u.role?.name ?? "No role"}</p>
              </div>
              <ActiveTag active={u.active} on="Enabled" off="Disabled" />
              {can(cu, "users", "edit") && (
                <>
                  <form action={resetMerchantUserPassword} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="merchant_id" value={m.id} />
                    <input
                      name="password"
                      type="text"
                      placeholder="new password"
                      className="input w-40 py-1.5 text-sm mono-num"
                      autoComplete="off"
                      required
                    />
                    <ActionButton icon="key" tip="Set this password — they must change it at next login" label="Reset" variant="outline" />
                  </form>
                  <form action={toggleMerchantUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="merchant_id" value={m.id} />
                    <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                    <ActionButton icon="power" tip={u.active ? "Disable this sign-in" : "Enable this sign-in"} variant="outline" />
                  </form>
                </>
              )}
            </div>
          ))}
          {(users ?? []).length === 0 && <p className="text-sm text-muted">No sign-ins yet — create the first below.</p>}
        </div>

        {can(cu, "users", "add") && (
          <form action={createMerchantUser} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4 sm:items-end">
            <input type="hidden" name="merchant_id" value={m.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Username</label>
              <input name="username" className="input" autoComplete="off" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">First password</label>
              <input name="password" type="text" className="input mono-num" autoComplete="off" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Display name</label>
              <input name="name" className="input" />
            </div>
            <ActionButton icon="plus" tip="Create a Partner Administrator sign-in" label="Add Account" variant="primary" />
          </form>
        )}
      </section>
    </div>
  );
}
