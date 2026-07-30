import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { saveDeviceModel } from "@/modules/expenses/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { fmtNum } from "@/lib/format";

type Model = { id: string; name: string; price: number; active: boolean };

// What we charge a customer for a device. Staff buys one and claims it under
// Expenses; the gap between claim and this price is the profit.
export default async function DeviceModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("expenses", "view");
  const { error } = await searchParams;
  const { data } = await db().from("device_models").select("*").order("name");
  const rows = (data ?? []) as Model[];
  const canEdit = Boolean(can(cu, "expenses", "edit"));

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/expenses" className="text-xs text-muted hover:text-foreground">← Expenses</Link>
        <h1 className="mt-1 text-xl font-semibold">Device Models</h1>
        <p className="mt-1 text-sm text-muted">Our selling price per model — editable, and new models can be added.</p>
      </div>
      <ErrorBanner message={error} />

      {canEdit && (
        <form action={saveDeviceModel} className="card grid gap-3 p-5 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-muted">New Model</label>
            <input name="name" className="input" placeholder="e.g. Redmi 13C" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Our Price</label>
            <input name="price" className="input mono-num" defaultValue={0} />
          </div>
          <ActionButton icon="plus" tip="Add this model" label="Add" variant="primary" />
        </form>
      )}

      <div className="card divide-y divide-border">
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-muted">No models yet.</p>}
        {rows.map((m) => (
          <form key={m.id} action={saveDeviceModel} className="flex flex-wrap items-end gap-3 px-4 py-3">
            <input type="hidden" name="id" value={m.id} />
            <div className="min-w-40 flex-1">
              <input name="name" defaultValue={m.name} className="input py-1.5 text-sm" disabled={!canEdit} />
            </div>
            <div className="w-32">
              <input name="price" defaultValue={fmtNum(m.price)} className="input mono-num py-1.5 text-sm" disabled={!canEdit} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-xs text-muted">
              <input type="checkbox" name="active" defaultChecked={m.active} disabled={!canEdit} /> Active
            </label>
            {canEdit && (
              <>
                <SaveButton tip={`Save ${m.name}`} label="" />
                <ActionButton icon="trash" tip={`Delete ${m.name}`} variant="danger" name="__delete" value="1" />
              </>
            )}
          </form>
        ))}
      </div>
    </div>
  );
}
