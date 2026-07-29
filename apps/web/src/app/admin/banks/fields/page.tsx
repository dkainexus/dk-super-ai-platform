import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { addBankField, removeBankField } from "@/modules/banks/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";

// Extra account fields per bank, all on one page — each bank asks for whatever
// it needs (Company ID, App PIN…) when an account is submitted.
export default async function BankFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("banks", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("banks")
    .select("id, name, account_fields")
    .eq("country_id", active.id)
    .eq("active", true)
    .order("sort")
    .order("name");
  const banks = (data ?? []) as { id: string; name: string; account_fields: { key: string; label: string }[] }[];
  const canEdit = Boolean(can(cu, "banks", "edit"));
  const back = "/admin/banks/fields";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/banks" className="text-xs text-muted hover:text-foreground">← Banks</Link>
        <h1 className="mt-1 text-xl font-semibold">Extra Account Fields</h1>
        <p className="mt-1 text-sm text-muted">
          What each bank in {active.name} asks for on top of the standard details — the account form follows this.
        </p>
      </div>
      <ErrorBanner message={error} />

      <div className="card divide-y divide-border">
        {banks.length === 0 && <p className="px-5 py-4 text-sm text-muted">No active banks yet.</p>}
        {banks.map((b) => (
          <div key={b.id} className="space-y-2 px-5 py-4">
            <p className="text-sm font-medium">{b.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              {(b.account_fields ?? []).length === 0 && <p className="text-xs text-muted">No extra fields.</p>}
              {(b.account_fields ?? []).map((f) => (
                <form key={f.key} action={removeBankField} className="inline-flex">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="country_id" value={active.id} />
                  <input type="hidden" name="key" value={f.key} />
                  <input type="hidden" name="back" value={back} />
                  <button
                    type="submit"
                    disabled={!canEdit}
                    title={`Remove ${f.label} from ${b.name}`}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs text-accent-strong transition-colors hover:border-danger/60 hover:text-danger disabled:opacity-60"
                  >
                    {f.label} <span className="text-muted group-hover:text-danger">✕</span>
                  </button>
                </form>
              ))}
            </div>
            {canEdit && (
              <form action={addBankField} className="flex max-w-sm items-center gap-2">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="country_id" value={active.id} />
                <input type="hidden" name="back" value={back} />
                <input name="label" placeholder="e.g. Company ID" className="input py-1.5 text-xs" />
                <button
                  type="submit"
                  title={`Add this field to ${b.name}`}
                  className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent"
                >
                  + Add
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
