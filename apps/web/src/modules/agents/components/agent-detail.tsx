import Link from "next/link";
import { db } from "@/lib/supabase";
import { updateAgent, setAgentStatus, issueAgentLogin, deleteAgent } from "../actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag, OwnerStatusTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { Table } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import { AuditLine } from "@/components/audit-line";
import type { OwnerStatus } from "@/lib/types";
import type { AgentRow } from "../lib";

// Shared agent profile for /admin/agents/:id and /m/agents/:id.
export async function AgentDetail({
  a,
  base,
  ownerBase,
  canEdit,
  canDelete,
  error,
  saved,
  conditions,
}: {
  a: AgentRow;
  base: string;
  ownerBase: string;
  canEdit: boolean;
  canDelete: boolean;
  error?: string;
  saved?: string;
  /** This agent's own bank × channel condition table, rendered by the page. */
  conditions?: React.ReactNode;
}) {
  const { data: owners } = await db()
    .from("owners")
    .select("id, ref, full_name, phone, status, created_at")
    .eq("agent_id", a.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const list = (owners ?? []) as {
    id: string; ref: string | null; full_name: string | null; phone: string | null; status: string; created_at: string;
  }[];
  const back = `${base}/${a.id}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href={base} className="text-xs text-muted hover:text-foreground">← Agents</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{a.full_name}</h1>
          <ActiveTag active={a.status === "active"} on="Active" off="Suspended" />
          {a.ref && (
            <span className="mono-num rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">{a.ref}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {a.merchant?.name ?? "—"}
          {a.country ? ` · ${a.country.flag ?? ""} ${a.country.name}` : ""} · {list.length} owners introduced
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "login" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Sign-in saved — the agent is asked to change the password at first login.
        </p>
      )}

      <section className="card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Details</h2>
        <form action={updateAgent} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="back" value={back} />
          <div>
            <label className="mb-1 block text-xs text-muted">Full Name</label>
            <input name="full_name" defaultValue={a.full_name} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Email</label>
            <input name="email" defaultValue={a.email ?? ""} className="input" disabled={!canEdit} />
          </div>
          {canEdit && <SaveButton tip="Save agent details" />}
        </form>
      </section>

      {canEdit && (
        <section className="card p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Sign-in</h2>
          <p className="mb-4 text-xs text-muted">
            {a.user
              ? `Signs in as ${a.user.username}. Setting a password here resets it.`
              : "No sign-in yet — give the agent a username and starter password."}
          </p>
          <form action={issueAgentLogin} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="back" value={back} />
            <div>
              <label className="mb-1 block text-xs text-muted">Username</label>
              <input name="username" defaultValue={a.user?.username ?? ""} autoComplete="off" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Password</label>
              <input name="password" type="text" autoComplete="off" className="input mono-num" />
            </div>
            <ActionButton icon="key" tip="Save this sign-in" label={a.user ? "Reset Password" : "Issue Sign-in"} variant="primary" />
          </form>
        </section>
      )}

      {conditions && (
        <section className="card p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Their Conditions</h2>
          <p className="mb-4 text-xs text-muted">
            This agent&apos;s own deal, bank by bank. An account freezes its row on activation day — edits here
            only touch accounts activated afterwards.
          </p>
          {conditions}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Owners introduced</h2>
        <Table head={["ID", "Name", "Phone", "Status", "Added", ""]}>
          {list.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-sm text-muted">No owners yet.</td>
            </tr>
          )}
          {list.map((o) => (
            <tr key={o.id} className="transition-colors hover:bg-surface-raised">
              <td className="mono-num px-4 py-2.5 text-xs text-muted">{o.ref ?? "—"}</td>
              <td className="px-4 py-2.5 font-medium">{o.full_name || "(no name yet)"}</td>
              <td className="mono-num px-4 py-2.5 text-muted">{o.phone || "—"}</td>
              <td className="px-4 py-2.5">
                <OwnerStatusTag status={o.status as OwnerStatus} />
              </td>
              <td className="px-4 py-2.5 text-muted">{new Date(o.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-2.5 text-right">
                <RowSettings href={`${ownerBase}/${o.id}`} tip="Open this owner" />
              </td>
            </tr>
          ))}
        </Table>
      </section>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <form action={setAgentStatus}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="status" value={a.status === "active" ? "suspended" : "active"} />
            <ActionButton
              icon="power"
              tip={a.status === "active" ? "Suspend — the agent can no longer sign in" : "Let this agent sign in again"}
              label={a.status === "active" ? "Suspend" : "Reactivate"}
            />
          </form>
          {canDelete && (
            <form action={deleteAgent} className="ml-auto">
              <input type="hidden" name="id" value={a.id} />
              <ActionButton icon="trash" tip="Delete this agent (their owners are kept)" variant="danger" />
            </form>
          )}
        </div>
      )}

      <AuditLine createdAt={a.created_at} />
    </div>
  );
}
