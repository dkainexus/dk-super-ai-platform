import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createTicketType, updateTicketType } from "@/modules/tickets/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { merchantFilterOptions } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";
import type { TicketType } from "@/modules/tickets/lib";

// The problems customers can report, per country — a white label can carry its
// own row of the same name, which shadows the country default for them.
export default async function TicketTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("tickets", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const [{ data }, merchants] = await Promise.all([
    db().from("ticket_types").select("*").eq("country_id", active.id).order("merchant_id").order("sort").order("name"),
    merchantFilterOptions(active.id),
  ]);
  const rows = (data ?? []) as TicketType[];
  const merchantName = new Map(merchants.map((m) => [m.value, m.label]));
  const canEdit = Boolean(can(cu, "tickets", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/tickets" className="text-xs text-muted hover:text-foreground">← Support</Link>
        <h1 className="mt-1 text-xl font-semibold">Ticket Types</h1>
        <p className="mt-1 text-sm text-muted">
          Each type carries who handles it by default, the deadline, and the two service prices — one for a phone
          call, one for sending the owner to the bank.
        </p>
      </div>
      <ErrorBanner message={error} />

      {canEdit && (
        <form action={createTicketType} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-7 lg:items-end">
          <input type="hidden" name="country_id" value={active.id} />
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs text-muted">New Type</label>
            <input name="name" className="input" placeholder="e.g. Account restricted" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Default Assignee</label>
            <select name="default_assignee" className="input">
              <option value="owner">Owner</option>
              <option value="phone_cs">Phone CS</option>
              <option value="customer">Customer</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Window (days)</label>
            <input name="window_days" type="number" min={1} defaultValue={14} className="input mono-num" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Phone Price</label>
            <input name="phone_price" className="input mono-num" defaultValue={0} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Visit Price</label>
            <input name="visit_price" className="input mono-num" defaultValue={0} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">White Label (blank = all)</label>
            <select name="merchant_id" className="input">
              <option value="">Country default</option>
              {merchants.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <ActionButton icon="plus" tip="Add this ticket type" label="Add" variant="primary" />
          </div>
        </form>
      )}

      <div className="space-y-3">
        {rows.length === 0 && <p className="card px-5 py-6 text-sm text-muted">No ticket types yet.</p>}
        {rows.map((t) => (
          <form key={t.id} action={updateTicketType} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-8 lg:items-end">
            <input type="hidden" name="id" value={t.id} />
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                {t.merchant_id ? `Only ${merchantName.get(t.merchant_id) ?? "one white label"}` : "Country default"}
              </label>
              <input name="name" defaultValue={t.name} className="input" disabled={!canEdit} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Assignee</label>
              <select name="default_assignee" defaultValue={t.default_assignee} className="input" disabled={!canEdit}>
                <option value="owner">Owner</option>
                <option value="phone_cs">Phone CS</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Window</label>
              <input name="window_days" type="number" min={1} defaultValue={t.window_days} className="input mono-num" disabled={!canEdit} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Phone</label>
              <input name="phone_price" defaultValue={fmtNum(t.phone_price)} className="input mono-num" disabled={!canEdit} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">Visit</label>
              <input name="visit_price" defaultValue={fmtNum(t.visit_price)} className="input mono-num" disabled={!canEdit} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input type="checkbox" name="active" defaultChecked={t.active} disabled={!canEdit} /> Active
            </label>
            {canEdit && (
              <div className="flex gap-2">
                <SaveButton tip={`Save ${t.name}`} label="" />
                <ActionButton icon="trash" tip={`Delete ${t.name}`} variant="danger" type="submit" name="__delete" value="1" />
              </div>
            )}
          </form>
        ))}
      </div>
    </div>
  );
}
