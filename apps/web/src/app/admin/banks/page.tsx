import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { createBank } from "@/modules/banks/actions";
import { BankReorder } from "@/modules/banks/components/bank-reorder";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton } from "@/components/action-buttons";
import { TableToolbar } from "@/components/data-table";
import { RowSettings } from "@/components/row-actions";
import { requireCountryScope } from "@/modules/countries/lib";

type Bank = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  sort: number;
  logo_path: string | null;
  account_fields: { key: string; label: string }[];
  channels: string[];
};

// Banks list for the active country. Drag a row to change the order shown
// everywhere; open a bank to edit its logo, extra fields and channels.
export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("banks", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();

  const { data: banks } = active
    ? await db().from("banks").select("*").eq("country_id", active.id).order("sort").order("name")
    : { data: [] };
  const rows = (banks ?? []) as Bank[];
  const logos = new Map(
    await Promise.all(rows.map(async (b) => [b.id, await signedUrl(ASSETS_BUCKET, b.logo_path)] as const))
  );

  const canEdit = can(cu, "banks", "edit");
  const canAdd = can(cu, "banks", "add");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Banks</h1>
        <p className="mt-1 text-sm text-muted">
          {active
            ? `${active.name} — drag a row to change the order shown everywhere.`
            : "Pick a country in the sidebar first."}
        </p>
      </div>
      <ErrorBanner message={error} />

      <TableToolbar count={rows.length} noun="bank" />

      {rows.length === 0 ? (
        <p className="card px-5 py-6 text-sm text-muted">No banks in {active?.name ?? "this country"} yet.</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <div className="min-w-[52rem]">
            <div className="grid grid-cols-[1.5rem_2.75rem_1fr_5rem_1.2fr_1.2fr_8rem] gap-3 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <span />
              <span />
              <span>Bank</span>
              <span>Code</span>
              <span>Extra Fields</span>
              <span>Payment Channels</span>
              <span>Status</span>
            </div>
            <BankReorder ids={rows.map((b) => b.id)} countryId={active!.id} canEdit={Boolean(canEdit)} dense>
              {rows.map((b) => {
                const logo = logos.get(b.id);
                return (
                  <div
                    key={b.id}
                    className="grid grid-cols-[2.75rem_1fr_5rem_1.2fr_1.2fr_8rem] items-center gap-3 px-3 py-2.5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span>🏦</span>
                      )}
                    </div>
                    <span className="truncate text-sm font-medium">{b.name}</span>
                    <span className="mono-num text-xs text-muted">{b.code || "—"}</span>
                    <span className="truncate text-xs text-muted">
                      {(b.account_fields ?? []).map((f) => f.label).join(", ") || "—"}
                    </span>
                    <span className="truncate text-xs text-muted">{(b.channels ?? []).join(", ") || "—"}</span>
                    <div className="flex items-center justify-between gap-2">
                      <ActiveTag active={b.active} />
                      <RowSettings href={`/admin/banks/${b.id}`} tip={`Open ${b.name}`} />
                    </div>
                  </div>
                );
              })}
            </BankReorder>
          </div>
        </div>
      )}

      {canAdd && active && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Add Bank — {active.name}</h2>
          <form action={createBank} className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <input type="hidden" name="country_id" value={active.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Bank Name</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Code (optional)</label>
              <input name="code" placeholder="BBL" className="input mono-num uppercase" />
            </div>
            <ActionButton icon="plus" tip="Add this bank" label="Add Bank" variant="primary" />
          </form>
        </section>
      )}
    </div>
  );
}
