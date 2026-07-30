import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { decideTermination } from "@/modules/contracts/policy-actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { Table, TableToolbar } from "@/components/data-table";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-success/40 bg-success/10 text-success",
  rejected: "border-danger/40 bg-danger/10 text-danger",
};

// Owners asking out. Approval is the last step of a negotiation: the agent's
// compensation is agreed first and recorded here — then the account closes
// and every contract line on it ends today.
export default async function TerminationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("contracts", "view");
  const { error, saved } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("termination_requests")
    .select("*, owner:owners(full_name, ref), bank_account:bank_accounts(account_no, bank:banks(name))")
    .eq("country_id", active.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as {
    id: string; reason: string | null; status: string; admin_note: string | null; created_at: string;
    owner: { full_name: string; ref: string | null } | null;
    bank_account: { account_no: string; bank: { name: string } | null } | null;
  }[];
  const canEdit = Boolean(can(cu, "contracts", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/contracts" className="text-xs text-muted hover:text-foreground">← Contracts</Link>
        <h1 className="mt-1 text-xl font-semibold">Termination Requests — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Submitted by owners from the app. Talk to the agent first — approval requires writing down what was
          agreed as compensation, then the account closes and everyone&apos;s billing on it stops today.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "approve" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Approved — the account is closed and every contract line on it ended today.
        </p>
      )}

      <TableToolbar count={rows.length} noun="request" />
      <Table head={["Requested", "Owner", "Account", "Reason", "Status", "Decision"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-6 text-sm text-muted">Nothing here.</td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="align-top transition-colors hover:bg-surface-raised">
            <td className="px-4 py-2.5 text-xs text-muted">{new Date(r.created_at).toLocaleString()}</td>
            <td className="px-4 py-2.5">
              {r.owner?.full_name ?? "?"}
              <span className="mono-num block text-xs text-muted">{r.owner?.ref ?? ""}</span>
            </td>
            <td className="px-4 py-2.5">
              {r.bank_account?.bank?.name ?? "?"}{" "}
              <span className="mono-num text-xs text-muted">{r.bank_account?.account_no}</span>
            </td>
            <td className="max-w-[16rem] px-4 py-2.5 text-sm text-muted">{r.reason ?? "—"}</td>
            <td className="px-4 py-2.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[r.status]}`}>
                {r.status}
              </span>
              {r.admin_note && <p className="mt-1 max-w-[14rem] text-[11px] text-muted">{r.admin_note}</p>}
            </td>
            <td className="px-4 py-2.5">
              {canEdit && r.status === "pending" && (
                <div className="space-y-2">
                  <form action={decideTermination} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <input
                      name="admin_note"
                      className="input w-52 py-1 text-xs"
                      placeholder="Agent compensation agreed…"
                    />
                    <ActionButton
                      icon="check"
                      tip="Approve — record the agreed compensation, close the account, end every contract line today"
                      label="Approve"
                      variant="success"
                    />
                  </form>
                  <form action={decideTermination}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <ActionButton icon="x" tip="Reject the request — the account keeps running" label="Reject" variant="danger" />
                  </form>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
