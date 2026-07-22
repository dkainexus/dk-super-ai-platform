import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { globalModuleToggles } from "@/lib/settings";
import { saveModuleToggles } from "@/app/actions/settings";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";
import { MODULES } from "@/modules/registry";

// Modules control center: switch business modules on/off globally and jump
// into each module's own settings page.
export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error } = await searchParams;
  const canEdit = can(cu, "settings", "edit");
  const toggles = await globalModuleToggles();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Modules</h1>
        <p className="mt-1 text-sm text-muted">
          Switch business modules on or off globally. A switched-off module disappears from every menu, dashboard and
          permission check. Individual merchants can additionally be opted out on their merchant page.
        </p>
      </div>
      <ErrorBanner message={error} />

      <form action={saveModuleToggles} className="space-y-3">
        {MODULES.map((m) => (
          <div
            key={m.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                {m.name}
                {m.core && (
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-normal text-muted">
                    Core — always on
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted">{m.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {m.settingsHref && (
                <Link
                  href={m.settingsHref}
                  title={`Open ${m.name} module settings`}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent"
                >
                  ⚙ Settings
                </Link>
              )}
              {!m.core && (
                <input
                  type="checkbox"
                  name={`mod_${m.key}`}
                  defaultChecked={toggles[m.key] !== false}
                  disabled={!canEdit}
                  title={`Switch the ${m.name} module on or off`}
                  className="h-4 w-4"
                />
              )}
            </div>
          </div>
        ))}
        {canEdit && <SaveButton tip="Save module on/off switches" />}
      </form>
    </div>
  );
}
