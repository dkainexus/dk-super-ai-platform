import { requirePerm } from "@/lib/auth";
import { tickets, isOverdue, applyOverdueFreezes, ASSIGNEE_LABEL } from "@/modules/tickets/lib";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { FilterForm } from "@/components/filter-form";
import { FilterSelect, Table, TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";

const STATUS_STYLE: Record<string, string> = {
  open: "border-warning/40 bg-warning/10 text-warning",
  assigned: "border-accent/40 bg-accent-soft text-accent-strong",
  handled: "border-border text-muted",
  resolved: "border-success/40 bg-success/10 text-success",
};

// The CS console: everything reported, who has it, and what is overdue.
// Loading this page also applies any freezes that fell due.
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  await requirePerm("tickets", "view");
  const { error, status = "" } = await searchParams;
  const { active } = await requireCountryScope();

  await applyOverdueFreezes();
  const rows = await tickets({ countryId: active?.id, status });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Support</h1>
        <p className="mt-1 text-sm text-muted">
          A ticket left with the owner past its deadline freezes the account&apos;s billing on its own — for
          everyone, from the following month.
        </p>
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={rows.length} noun="ticket">
        <FilterForm action="/admin/tickets">
          <FilterSelect
            label="Status"
            name="status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "open", label: "Open — needs triage" },
              { value: "assigned", label: "Assigned" },
              { value: "handled", label: "Handled (still unusable)" },
              { value: "resolved", label: "Resolved" },
            ]}
          />
        </FilterForm>
      </TableToolbar>

      <Table head={["ID", "Account", "Customer", "Type", "Assigned To", "Deadline", "Status", ""]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-sm text-muted">No tickets match.</td>
          </tr>
        )}
        {rows.map((t) => (
          <tr key={t.id} className="transition-colors hover:bg-surface-raised">
            <td className="mono-num px-4 py-2.5 text-xs text-muted">{t.ref ?? "—"}</td>
            <td className="px-4 py-2.5">
              <span className="font-medium">{t.bank_account?.bank?.name ?? "?"}</span>{" "}
              <span className="mono-num text-xs text-muted">{t.bank_account?.account_no}</span>
              {t.bank_account?.billing_frozen && (
                <span className="ml-2 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-[10px] text-danger">
                  frozen
                </span>
              )}
            </td>
            <td className="px-4 py-2.5 text-muted">{t.customer?.name ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{t.type?.name ?? "—"}</td>
            <td className="px-4 py-2.5 text-muted">{t.assigned_to ? ASSIGNEE_LABEL[t.assigned_to] : "—"}</td>
            <td className="mono-num px-4 py-2.5">
              {t.deadline ?? "—"}
              {isOverdue(t, today) && <span className="ml-1 text-danger">overdue</span>}
            </td>
            <td className="px-4 py-2.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] capitalize ${STATUS_STYLE[t.status]}`}>
                {t.status}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right">
              <RowSettings href={`/admin/tickets/${t.id}`} tip={`Open ${t.ref ?? "this ticket"}`} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
