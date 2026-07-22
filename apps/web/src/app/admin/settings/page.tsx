import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { platformSettings } from "@/lib/settings";
import { savePlatformSettings } from "@/app/actions/settings";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("settings", "view");
  const { error } = await searchParams;
  const platform = await platformSettings();

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
