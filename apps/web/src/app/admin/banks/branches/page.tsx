import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { addBranch, updateBranch, deleteBranch } from "@/modules/banks/actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton, SaveButton } from "@/components/action-buttons";
import { BranchPicker } from "@/modules/banks/components/branch-picker";
import type { Country } from "@/lib/types";

type Branch = { id: string; bank_id: string; name: string; address: string | null; place_id: string | null };
type Bank = { id: string; name: string; country_id: string };

// Branch directory: grows as admins process app submissions; future
// submissions pick from this list instead of uploading map screenshots.
export default async function BranchesPage({
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
    ? await db().from("banks").select("id, name, country_id").eq("country_id", selected.id).eq("active", true).order("sort").order("name")
    : { data: [] };
  const bankRows = (banks ?? []) as Bank[];
  const { data: branches } = bankRows.length
    ? await db().from("bank_branches").select("*").in("bank_id", bankRows.map((b) => b.id)).order("name")
    : { data: [] };
  const branchRows = (branches ?? []) as Branch[];

  const canAdd = can(cu, "banks", "add");
  const canEdit = can(cu, "banks", "edit");
  const canDelete = can(cu, "banks", "delete");
  const back = selected ? `/admin/banks/branches?country=${selected.id}` : "/admin/banks/branches";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/banks" className="text-xs text-muted hover:text-foreground">← Banks</Link>
        <h1 className="mt-1 text-xl font-semibold">Branches</h1>
        <p className="mt-1 text-sm text-muted">
          Branch directory per bank. App submissions pick from this list — screenshots you process on the Bank
          Accounts page land here automatically.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="flex flex-wrap items-center gap-2">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/admin/banks/branches?country=${c.id}`}
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

      {bankRows.map((bank) => {
        const mine = branchRows.filter((br) => br.bank_id === bank.id);
        return (
          <section key={bank.id} className="card space-y-3 p-5">
            <h2 className="text-sm font-semibold">
              {bank.name} <span className="text-xs font-normal text-muted">· {mine.length} branches</span>
            </h2>
            {mine.map((br) => (
              <form key={br.id} action={updateBranch} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto_auto]">
                <input type="hidden" name="id" value={br.id} />
                <input type="hidden" name="back" value={back} />
                <div>
                  <label className="mb-1 block text-xs text-muted">Branch Name</label>
                  <input name="name" defaultValue={br.name} className="input" disabled={!canEdit} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Address</label>
                  <input name="address" defaultValue={br.address ?? ""} className="input" disabled={!canEdit} />
                </div>
                {canEdit ? <SaveButton tip="Save this branch" /> : <span />}
                {canDelete && (
                  <button
                    type="submit"
                    formAction={deleteBranch}
                    title="Delete this branch"
                    className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                  >
                    Delete
                  </button>
                )}
              </form>
            ))}
            {canAdd && (
              <form action={addBranch} className="grid items-end gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="bank_id" value={bank.id} />
                <input type="hidden" name="back" value={back} />
                <BranchPicker regionCode={selected.code} label="Add a branch — search Google Maps" />
                <ActionButton icon="plus" tip="Add the picked branch to the directory" label="Add" variant="primary" />
              </form>
            )}
          </section>
        );
      })}
      {bankRows.length === 0 && selected && (
        <p className="card px-5 py-6 text-sm text-muted">No active banks in {selected.name} yet.</p>
      )}
    </div>
  );
}
