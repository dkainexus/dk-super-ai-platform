import { setOwnerAppAccess } from "../actions";
import { SaveButton } from "@/components/action-buttons";
import type { Owner } from "@/lib/types";

/** Mobile-app login credentials card, shown on the owner detail pages. */
export function AppAccessCard({ owner, back }: { owner: Owner; back: string }) {
  const hasAccess = Boolean(owner.app_username && owner.app_password_hash);
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Mobile App Access</h2>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] ${
            hasAccess ? "border-accent/40 text-accent-strong" : "border-border text-muted"
          }`}
        >
          {hasAccess ? "Enabled" : "Not set"}
        </span>
      </div>
      <form action={setOwnerAppAccess} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <input type="hidden" name="id" value={owner.id} />
        <input type="hidden" name="back" value={back} />
        <div>
          <label className="mb-1 block text-xs text-muted">Username</label>
          <input
            name="app_username"
            defaultValue={owner.app_username ?? ""}
            placeholder="e.g. somchai01"
            className="input mono-num"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">
            {hasAccess ? "New password (blank = keep current)" : "Password"}
          </label>
          <input name="app_password" type="password" className="input" autoComplete="new-password" />
        </div>
        <SaveButton tip="Save app credentials" />
        {hasAccess && (
          <button
            type="submit"
            name="clear"
            value="true"
            title="Remove app access for this owner"
            className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            Remove
          </button>
        )}
      </form>
      <p className="mt-3 text-xs text-muted">
        {owner.app_last_login_at
          ? `Last app login: ${new Date(owner.app_last_login_at).toLocaleString()}`
          : "The owner has not signed in to the app yet."}
      </p>
    </section>
  );
}
