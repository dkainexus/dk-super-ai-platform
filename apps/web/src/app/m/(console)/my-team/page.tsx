import { redirect } from "next/navigation";
import { requireMerchantUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { isPrimaryAgentUser } from "@/modules/agents/lib";
import {
  createAgentWorker,
  resetAgentWorkerPassword,
  setAgentWorkerActive,
} from "@/modules/agents/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SubmitButton } from "@/components/action-buttons";
import { Table } from "@/components/data-table";

// The agent's own workforce: sub-accounts that sign in and enter owners on
// the agent's behalf — everything they add lands under this agent.
export default async function AgentTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const cu = await requireMerchantUser();
  const agent = await isPrimaryAgentUser(cu.user.id);
  if (!agent) redirect("/admin");
  const { error, saved } = await searchParams;

  const { data: workers } = await db()
    .from("users")
    .select("id, username, name, active, must_change_password, created_at")
    .eq("agent_id", agent.id)
    .order("created_at");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My Team</h1>
        <p className="mt-1 text-sm text-muted">
          Sign-ins for your workers. Whatever they enter counts as yours — owners they add are recorded
          under you.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          ✅ Saved. New sign-ins must change their password on first login.
        </p>
      )}

      <section className="card space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">New worker sign-in</h2>
        <form action={createAgentWorker} className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Username</label>
            <input name="username" className="input" autoComplete="off" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Temporary password</label>
            <input name="password" className="input" autoComplete="new-password" required />
          </div>
          <div className="sm:col-span-3">
            <SubmitButton label="Create Sign-In" />
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Workers</h2>
        <Table head={["Name", "Username", "Status", "Actions"]}>
          {(workers ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-sm text-muted">No workers yet.</td>
            </tr>
          )}
          {(workers ?? []).map((w) => (
            <tr key={w.id} className="transition-colors hover:bg-surface-raised">
              <td className="px-4 py-2.5 font-medium">{w.name}</td>
              <td className="mono-num px-4 py-2.5 text-muted">{w.username}</td>
              <td className="px-4 py-2.5">
                {w.active ? (
                  <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs text-success">Active</span>
                ) : (
                  <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs text-danger">Disabled</span>
                )}
                {w.must_change_password && (
                  <span className="ml-2 text-xs text-muted">must change password</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <details className="relative">
                    <summary className="cursor-pointer list-none text-xs text-accent-strong hover:underline">
                      Reset password
                    </summary>
                    <form
                      action={resetAgentWorkerPassword}
                      className="absolute right-0 z-10 mt-2 flex w-64 items-end gap-2 rounded-xl border border-border bg-surface p-3 shadow-xl"
                    >
                      <input type="hidden" name="id" value={w.id} />
                      <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-xs text-muted">New password</label>
                        <input name="password" className="input" autoComplete="new-password" required />
                      </div>
                      <ActionButton icon="check" tip="Set the new password" variant="primary" />
                    </form>
                  </details>
                  <form action={setAgentWorkerActive}>
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="active" value={w.active ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`text-xs hover:underline ${w.active ? "text-danger" : "text-success"}`}
                    >
                      {w.active ? "Disable" : "Enable"}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
