import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { requireCountryScope } from "@/modules/countries/lib";
import { assignmentsFor, assignmentDeadline } from "@/modules/contracts/customer-policy";
import { markAssignmentReady, cancelAssignment, setAssignmentDelivery } from "@/modules/contracts/policy-actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";
import { Table, TableToolbar, FilterSelect } from "@/components/data-table";
import { FilterForm } from "@/components/filter-form";
import { fmtNum } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  awaiting_confirmation: "border-warning/40 bg-warning/10 text-warning",
  confirmed: "border-accent/40 bg-accent-soft text-accent-strong",
  live: "border-success/40 bg-success/10 text-success",
  cancelled: "border-border text-muted",
};
const STATUS_LABEL: Record<string, string> = {
  awaiting_confirmation: "awaiting customer",
  confirmed: "confirmed — binding",
  live: "live",
  cancelled: "cancelled",
};

// Every account offered to a customer and where it stands. Billing starts the
// day after binding completes — and on day 14 regardless.
export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; status?: string }>;
}) {
  const { cu } = await requirePerm("contracts", "view");
  const { error, saved, status = "" } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const rows = await assignmentsFor({ countryId: active.id, status: status || undefined });
  const canEdit = Boolean(can(cu, "contracts", "edit"));
  const back = "/admin/contracts/assignments";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/contracts" className="text-xs text-muted hover:text-foreground">← Contracts</Link>
        <h1 className="mt-1 text-xl font-semibold">Assignments — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Accounts are assigned from their own page. The customer confirms the agreement in the portal, the
          binding or delivery happens, and billing starts the next day — no later than 14 days after
          assignment, whatever happens.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved === "live" && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Live — billing starts tomorrow (or on the day-14 cap if that is sooner).
        </p>
      )}

      <TableToolbar count={rows.length} noun="assignment">
        <FilterForm action={back}>
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[
              { value: "", label: "All" },
              { value: "awaiting_confirmation", label: "Awaiting customer" },
              { value: "confirmed", label: "Confirmed — binding" },
              { value: "live", label: "Live" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Account", "Customer", "Price", "Delivery", "Assigned", "Deadline", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={9} className="px-4 py-6 text-sm text-muted">Nothing here.</td>
          </tr>
        )}
        {rows.map((a) => {
          const c = a.conditions as { rent?: number; mode?: string };
          return (
            <tr key={a.id} className="align-top transition-colors hover:bg-surface-raised">
              <td className="mono-num px-4 py-2.5 text-xs text-muted">{a.ref ?? "—"}</td>
              <td className="px-4 py-2.5">
                {a.bank_account?.bank?.name ?? "?"}{" "}
                <span className="mono-num text-xs text-muted">{a.bank_account?.account_no}</span>
              </td>
              <td className="px-4 py-2.5">{a.customer?.name ?? "?"}</td>
              <td className="mono-num px-4 py-2.5">{c.rent != null ? fmtNum(c.rent) : "—"}</td>
              <td className="px-4 py-2.5">
                {canEdit && a.status !== "live" && a.status !== "cancelled" ? (
                  <form action={setAssignmentDelivery} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="back" value={back} />
                    <select name="delivery_method" defaultValue={a.delivery_method} className="input py-1 text-xs" data-autosubmit>
                      <option value="direct">Direct binding</option>
                      <option value="mail">Mail</option>
                    </select>
                  </form>
                ) : (
                  <span className="text-muted">{a.delivery_method === "mail" ? "Mail" : "Direct binding"}</span>
                )}
                {a.address && (
                  <p className="mt-1 max-w-[14rem] text-[11px] text-muted">
                    {a.address.name} · {a.address.phone} · {a.address.address}
                  </p>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted">{a.assigned_on}</td>
              <td className="mono-num px-4 py-2.5 text-xs text-muted">
                {a.status === "live" ? (a.live_on ?? "—") : assignmentDeadline(a.assigned_on)}
              </td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${STATUS_STYLE[a.status]}`}>
                  {STATUS_LABEL[a.status]}
                </span>
              </td>
              <td className="px-4 py-2.5">
                {canEdit && a.status === "confirmed" && (
                  <div className="flex flex-col items-end gap-2">
                    <form action={markAssignmentReady}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="back" value={back} />
                      <ActionButton
                        icon="check"
                        tip={
                          a.delivery_method === "mail"
                            ? "Delivered and tested working — billing starts tomorrow"
                            : "Binding finished — billing starts tomorrow"
                        }
                        label="Bound & Working"
                        variant="success"
                      />
                    </form>
                  </div>
                )}
                {canEdit && a.status !== "live" && a.status !== "cancelled" && (
                  <form action={cancelAssignment} className="mt-2 text-right">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="back" value={back} />
                    <ActionButton icon="x" tip="Withdraw this offer" label="Cancel" variant="danger" />
                  </form>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
