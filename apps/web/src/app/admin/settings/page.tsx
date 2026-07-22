import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { platformSettings, globalModuleToggles } from "@/lib/settings";
import { savePlatformSettings, saveModuleToggles } from "@/app/actions/settings";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";
import { TOGGLABLE_MODULES, MODULES } from "@/modules/registry";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("settings", "view");
  const { error } = await searchParams;
  const [platform, toggles] = await Promise.all([platformSettings(), globalModuleToggles()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Platform-wide configuration. Everything here applies globally.</p>
      </div>
      <ErrorBanner message={error} />

      {/* General */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">General</h2>
        <p className="mb-4 text-xs text-muted">Basic platform identity.</p>
        <form action={savePlatformSettings} className="flex max-w-md items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Platform Name (shown in the sidebar & login page)</label>
            <input name="name" defaultValue={platform.name} className="input" required />
          </div>
          <SaveButton tip="Save general settings" />
        </form>
      </section>

      {/* Module settings */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Module Settings</h2>
        <p className="mb-3 text-xs text-muted">Per-module configuration pages.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/settings/owners" className="inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">
            Owners — occupations & module options →
          </Link>
          <Link href="/admin/settings/ai" className="inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">
            AI Assistant — provider & API keys →
          </Link>
        </div>
      </section>

      {/* Modules */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Modules</h2>
        <p className="mb-4 text-xs text-muted">
          Switch business modules on or off globally. A switched-off module disappears from every menu, dashboard and
          permission check. Individual merchants can additionally be opted out on their merchant page.
        </p>
        <form action={saveModuleToggles} className="space-y-3">
          {TOGGLABLE_MODULES.map((m) => (
            <label key={m.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-accent">
              <span>
                <span className="block text-sm font-medium">{m.name}</span>
                <span className="block text-xs text-muted">{m.description}</span>
              </span>
              <input type="checkbox" name={`mod_${m.key}`} defaultChecked={toggles[m.key] !== false} className="h-4 w-4" />
            </label>
          ))}
          <div className="space-y-2 pt-1">
            {MODULES.filter((m) => m.core).map((m) => (
              <p key={m.key} className="text-xs text-muted">
                <span className="rounded-full bg-surface-raised px-2 py-0.5">Core</span> {m.name} — always on
              </p>
            ))}
          </div>
          <SaveButton tip="Save module toggles" />
        </form>
      </section>

      {/* Bot tools */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Bot Tools</h2>
        <p className="mb-3 text-xs text-muted">Telegram bot operations (legacy group flow).</p>
        <div className="flex gap-3">
          <Link href="/dashboard/documents" className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">
            Document Review
          </Link>
          <Link href="/dashboard/jobs" className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">
            Bot Jobs
          </Link>
        </div>
      </section>
    </div>
  );
}
