import { saveConditionRow, deleteConditionRow, copyTemplateToAgentAction } from "@/modules/contracts/policy-actions";
import { ActionButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";
import { fmtNum } from "@/lib/format";
import type { ConditionRow } from "@/modules/contracts/policy";

const MODES = [
  { value: "rent", label: "Rent only" },
  { value: "turnover", label: "Turnover only" },
  { value: "rent_plus_turnover", label: "Rent + turnover" },
  { value: "max", label: "Rent or turnover (higher)" },
] as const;

const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.value, m.label]));

function RowForm({
  row,
  banks,
  channels,
  hidden,
}: {
  row: ConditionRow | null;
  banks: { id: string; name: string }[];
  channels: string[];
  hidden: Record<string, string>;
}) {
  return (
    <form
      action={saveConditionRow}
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_7rem_5rem_4.5rem_4.5rem_7rem_auto] lg:items-end"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {row && <input type="hidden" name="row_id" value={row.id} />}
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Bank</label>
        <select name="bank_id" defaultValue={row?.bank_id ?? ""} className="input py-1.5 text-sm" required>
          <option value="">— Bank —</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Channel</label>
        <select name="channel" defaultValue={row?.channel ?? ""} className="input py-1.5 text-sm">
          <option value="">Default (any)</option>
          {channels.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Mode</label>
        <select name="mode" defaultValue={row?.mode ?? "rent"} className="input py-1.5 text-sm">
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Rent</label>
        <MoneyInput name="rent" defaultValue={row ? Number(row.rent) : 0} />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Turnover %</label>
        <input name="turnover_pct" defaultValue={row?.turnover_pct ?? ""} className="input mono-num py-1.5 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Contract</label>
        <input name="contract_months" defaultValue={row?.contract_months ?? ""} className="input mono-num py-1.5 text-sm" placeholder="mo" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Renewal</label>
        <input name="renewal_months" defaultValue={row?.renewal_months ?? ""} className="input mono-num py-1.5 text-sm" placeholder="mo" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Deposit</label>
        <MoneyInput name="deposit" defaultValue={row ? Number(row.deposit) : 0} />
      </div>
      <ActionButton
        icon={row ? "save" : "plus"}
        tip={row ? "Save this row — only affects accounts activated from now on" : "Add this condition row"}
        label={row ? "Save" : "Add"}
        variant={row ? "outline" : "primary"}
      />
    </form>
  );
}

/**
 * The bank × channel condition table — the white label's default template
 * (agentId absent) or one agent's own copy. Pure-turnover rows have no
 * contract months: their liability runs for as long as the account does.
 */
export function ConditionTable({
  rows,
  banks,
  channels,
  canEdit,
  hidden,
  agentId,
  emptyText,
  showCopy,
}: {
  rows: ConditionRow[];
  banks: { id: string; name: string }[];
  channels: string[];
  canEdit: boolean;
  /** Context fields every form posts back: back, and merchant/country on admin. */
  hidden: Record<string, string>;
  agentId?: string;
  emptyText: string;
  showCopy?: boolean;
}) {
  const withAgent = agentId ? { ...hidden, agent_id: agentId } : hidden;
  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">{emptyText}</p>
          {canEdit && showCopy && agentId && (
            <form action={copyTemplateToAgentAction}>
              {Object.entries(withAgent).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <ActionButton icon="plus" tip="Copy the white label's default conditions onto this agent" label="Copy Defaults" variant="primary" />
            </form>
          )}
        </div>
      )}

      {rows.length > 0 && !canEdit && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Bank</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2 text-right">Rent</th>
                <th className="px-3 py-2 text-right">Turnover %</th>
                <th className="px-3 py-2 text-right">Contract</th>
                <th className="px-3 py-2 text-right">Renewal</th>
                <th className="px-3 py-2 text-right">Deposit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.bank?.name ?? "?"}</td>
                  <td className="px-3 py-2 text-muted">{r.channel ?? "default"}</td>
                  <td className="px-3 py-2">{MODE_LABEL[r.mode]}</td>
                  <td className="mono-num px-3 py-2 text-right">{r.mode === "turnover" ? "—" : fmtNum(r.rent)}</td>
                  <td className="mono-num px-3 py-2 text-right">{r.turnover_pct ?? "—"}</td>
                  <td className="mono-num px-3 py-2 text-right">{r.contract_months ?? "open"}</td>
                  <td className="mono-num px-3 py-2 text-right">{r.renewal_months ?? "—"}</td>
                  <td className="mono-num px-3 py-2 text-right">{fmtNum(r.deposit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit &&
        rows.map((r) => (
          <div key={r.id} className="flex items-end gap-2 border-b border-border pb-3">
            <div className="min-w-0 flex-1">
              <RowForm row={r} banks={banks} channels={channels} hidden={withAgent} />
            </div>
            <form action={deleteConditionRow}>
              {Object.entries(withAgent).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <input type="hidden" name="row_id" value={r.id} />
              <ActionButton icon="trash" tip="Delete this row — accounts already running keep their frozen copy" variant="danger" />
            </form>
          </div>
        ))}

      {canEdit && (
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Add a row</p>
          <RowForm row={null} banks={banks} channels={channels} hidden={withAgent} />
        </div>
      )}
    </div>
  );
}
