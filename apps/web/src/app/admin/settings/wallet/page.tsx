import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { walletSettings } from "@/modules/wallet/lib";
import { saveWalletSettings } from "@/modules/wallet/actions";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";
import type { Country } from "@/lib/types";

// Wallet module settings: the training-completion reward per country
// (in that country's currency; empty = no automatic reward).
export default async function WalletSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("settings", "view");
  const { error, saved } = await searchParams;
  const canEdit = can(cu, "settings", "edit");

  const [{ data: countries }, settings] = await Promise.all([
    db().from("countries").select("*").order("sort").order("name"),
    walletSettings(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/modules" className="text-xs text-muted hover:text-foreground">
          ← Modules
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Wallet Module Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Automatic rewards. The training-completion reward is credited once per owner, the moment they finish every
          published training video. Leave a country empty to disable it there.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          Settings saved.
        </p>
      )}

      <form action={saveWalletSettings} className="space-y-3">
        {((countries ?? []) as Country[]).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <span className="text-sm">
              {c.flag || "🌐"} {c.name}
            </span>
            <div className="flex items-center gap-2">
              <input
                name={`tr_${c.id}`}
                type="number"
                step="0.01"
                min="0"
                defaultValue={settings.training_rewards[c.id] ?? ""}
                placeholder="off"
                disabled={!canEdit}
                className="input mono-num w-32 text-right"
              />
              <span className="mono-num w-12 text-xs text-muted">{c.currency}</span>
            </div>
          </div>
        ))}
        {(countries ?? []).length === 0 && <p className="card px-5 py-6 text-sm text-muted">No countries yet.</p>}
        {canEdit && <SaveButton tip="Save training reward amounts" />}
      </form>
    </div>
  );
}
