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
import { ActiveTag } from "@/components/status-tag";
import { ImagePicker } from "@/components/image-picker";
import { saveAppSettings, uploadAppIcon, removeAppIcon, queueAppBuild } from "@/modules/merchants/actions-app";
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
  const [{ data: users }, logoUrl, { data: buildRows }] = await Promise.all([
    db().from("users").select("*, role:roles(*)").eq("merchant_id", id).order("created_at"),
    signedUrl(ASSETS_BUCKET, m.logo_path),
    db().from("app_builds").select("*").eq("merchant_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const disabled = (m.disabled_modules ?? []) as string[];
  const appIcon = await signedUrl(ASSETS_BUCKET, (m as { app_icon_path?: string | null }).app_icon_path);
  const builds = await Promise.all(
    ((buildRows ?? []) as {
      id: string; version_name: string; status: string; apk_path: string | null; created_at: string;
    }[]).map(async (b) => ({ ...b, apk_url: await signedUrl("app-releases", b.apk_path, 60 * 60 * 24) }))
  );

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


      {/* Branded mobile app */}
      {canEdit && (
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Mobile App</h2>
            <p className="mt-1 text-xs text-muted">
              This white label&apos;s own Android app — its name, icon and package. Building queues a job on the
              build server; the finished APK appears below.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <ImagePicker
              url={appIcon}
              canEdit={canEdit}
              uploadAction={uploadAppIcon}
              removeAction={removeAppIcon}
              fieldName="icon"
              hidden={{ id: m.id }}
              fallback="📱"
              tip="app icon"
              size="h-14 w-14"
            />
            <form action={saveAppSettings} className="flex flex-1 flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={m.id} />
              <div className="min-w-48 flex-1">
                <label className="mb-1 block text-xs text-muted">App Name</label>
                <input name="app_name" defaultValue={m.app_name ?? ""} placeholder="e.g. Bo Le Work" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Package</label>
                <p className="mono-num rounded-md border border-border bg-surface-raised px-3 py-2 text-xs text-muted">
                  {m.app_package_id ?? "set on first save"}
                </p>
              </div>
              <SaveButton tip="Save the app name and icon" />
            </form>
            <form action={queueAppBuild}>
              <input type="hidden" name="id" value={m.id} />
              <ActionButton icon="upload" tip="Queue a new APK build for this white label" label="Build APK" variant="primary" />
            </form>
          </div>

          <div className="card divide-y divide-border p-0">
            {builds.length === 0 && <p className="px-4 py-3 text-xs text-muted">No builds yet.</p>}
            {builds.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div>
                  <p className="mono-num text-sm">v{b.version_name}</p>
                  <p className="text-xs text-muted">{new Date(b.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${
                      b.status === "ready"
                        ? "border-success/40 bg-success/10 text-success"
                        : b.status === "failed"
                          ? "border-danger/40 bg-danger/10 text-danger"
                          : "border-warning/40 bg-warning/10 text-warning"
                    }`}
                  >
                    {b.status}
                  </span>
                  {b.apk_url && (
                    <a
                      href={b.apk_url}
                      className="rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:border-accent"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
