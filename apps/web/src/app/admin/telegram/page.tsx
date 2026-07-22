import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { maskToken } from "@/modules/telegram/lib";
import {
  createTelegramBot,
  updateTelegramBot,
  verifyTelegramBot,
  deleteTelegramBot,
} from "@/modules/telegram/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import type { TelegramBot } from "@/lib/types";

// Telegram module: shared bot registry. Paste a BotFather token — it is
// validated against the Telegram API on the spot. What each bot is used for
// gets attached later (flows, notifications, …).
export default async function TelegramPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("telegram", "view");
  const { error } = await searchParams;

  const { data: bots } = await db().from("telegram_bots").select("*").order("created_at");
  const canEdit = can(cu, "telegram", "edit");
  const canAdd = can(cu, "telegram", "add");
  const canDelete = can(cu, "telegram", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Telegram Bots</h1>
        <p className="mt-1 text-sm text-muted">
          Shared bot registry. Create a bot with{" "}
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-accent-strong underline">
            @BotFather
          </a>{" "}
          and paste its token here — it is verified with Telegram immediately.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="space-y-3">
        {((bots ?? []) as TelegramBot[]).length === 0 && (
          <p className="card px-5 py-6 text-sm text-muted">No bots registered yet.</p>
        )}
        {((bots ?? []) as TelegramBot[]).map((b) => (
          <div key={b.id} className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {b.bot_username ? (
                    <a href={`https://t.me/${b.bot_username}`} target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">
                      @{b.bot_username}
                    </a>
                  ) : (
                    "(unverified)"
                  )}
                </span>
                <span className="mono-num text-xs text-muted">{maskToken(b.token)}</span>
                {b.last_check_ok === true && (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                    ✓ Healthy{b.last_check_at ? ` · ${new Date(b.last_check_at).toLocaleString()}` : ""}
                  </span>
                )}
                {b.last_check_ok === false && (
                  <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger">✗ Check failed</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ActiveTag active={b.active} />
                <form action={verifyTelegramBot}>
                  <input type="hidden" name="id" value={b.id} />
                  <ActionButton icon="check" tip="Run a health check against the Telegram API" label="Verify" />
                </form>
                {canDelete && (
                  <form action={deleteTelegramBot}>
                    <input type="hidden" name="id" value={b.id} />
                    <ActionButton icon="trash" tip="Remove this bot from the registry" variant="danger" />
                  </form>
                )}
              </div>
            </div>
            {canEdit && (
              <form action={updateTelegramBot} className="grid items-end gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_2fr_5rem_auto]">
                <input type="hidden" name="id" value={b.id} />
                <div>
                  <label className="mb-1 block text-xs text-muted">Name</label>
                  <input name="name" defaultValue={b.name} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Note (what is this bot for?)</label>
                  <input name="note" defaultValue={b.note ?? ""} placeholder="Purpose to be decided" className="input" />
                </div>
                <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                  <input type="checkbox" name="active" defaultChecked={b.active} /> Active
                </label>
                <SaveButton tip="Save name and note" />
              </form>
            )}
          </div>
        ))}
      </div>

      {canAdd && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Add Bot</h2>
          <form action={createTelegramBot} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted">Name (optional, defaults to the bot&apos;s name)</label>
              <input name="name" className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Bot Token (from @BotFather)</label>
              <input name="token" placeholder="123456789:ABC-DEF..." autoComplete="off" className="input mono-num" required />
            </div>
            <ActionButton icon="plus" tip="Validate the token with Telegram and register the bot" label="Add Bot" variant="primary" />
          </form>
        </section>
      )}
    </div>
  );
}
