import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createBank, updateBank, deleteBank } from "@/modules/banks/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import type { Country } from "@/lib/types";

type Bank = {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  active: boolean;
  sort: number;
};

// Banks module: per-country bank directory. Fully editable — add, edit,
// deactivate or delete banks per country.
export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; error?: string }>;
}) {
  const { cu } = await requirePerm("banks", "view");
  const { country = "", error } = await searchParams;

  const { data: countries } = await db().from("countries").select("*").eq("active", true).order("sort");
  const list = (countries ?? []) as Country[];
  const selected = list.find((c) => c.id === country) ?? list[0] ?? null;

  const { data: banks } = selected
    ? await db().from("banks").select("*").eq("country_id", selected.id).order("sort").order("name")
    : { data: [] };

  const canEdit = can(cu, "banks", "edit");
  const canAdd = can(cu, "banks", "add");
  const canDelete = can(cu, "banks", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Banks</h1>
        <p className="mt-1 text-sm text-muted">Bank directory per country, used across the platform.</p>
      </div>
      <ErrorBanner message={error} />

      {/* Country tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/admin/banks?country=${c.id}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              selected?.id === c.id
                ? "border-accent bg-accent-soft text-accent-strong"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {c.flag} {c.name}
          </Link>
        ))}
      </div>

      {selected && (
        <>
          <div className="space-y-3">
            {((banks ?? []) as Bank[]).length === 0 && (
              <p className="card px-5 py-6 text-sm text-muted">No banks for {selected.name} yet.</p>
            )}
            {((banks ?? []) as Bank[]).map((b) => (
              <div key={b.id} className="card p-4">
                {canEdit ? (
                  <form action={updateBank} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_6rem_5rem_auto_auto]">
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="country_id" value={selected.id} />
                    <div>
                      <label className="mb-1 block text-xs text-muted">Name</label>
                      <input name="name" defaultValue={b.name} className="input" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Code</label>
                      <input name="code" defaultValue={b.code ?? ""} className="input mono-num uppercase" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">Sort</label>
                      <input name="sort" type="number" defaultValue={b.sort} className="input mono-num" />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                      <input type="checkbox" name="active" defaultChecked={b.active} /> Active
                    </label>
                    <SaveButton tip="Save this bank" />
                    {canDelete && (
                      <button
                        type="submit"
                        formAction={deleteBank}
                        title="Delete this bank"
                        className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                      >
                        Delete
                      </button>
                    )}
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {b.name} {b.code && <span className="mono-num text-xs text-muted">({b.code})</span>}
                    </p>
                    <ActiveTag active={b.active} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {canAdd && (
            <section className="card p-5">
              <h2 className="mb-4 text-sm font-semibold">
                Add Bank — {selected.flag} {selected.name}
              </h2>
              <form action={createBank} className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                <input type="hidden" name="country_id" value={selected.id} />
                <div>
                  <label className="mb-1 block text-xs text-muted">Bank Name</label>
                  <input name="name" className="input" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Code (optional)</label>
                  <input name="code" placeholder="KBANK" className="input mono-num uppercase" />
                </div>
                <ActionButton icon="plus" tip="Add this bank" label="Add Bank" variant="primary" />
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
}
