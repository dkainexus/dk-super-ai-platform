import { AuditLine } from "@/components/audit-line";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { updateBank, deleteBank, addBankField, removeBankField } from "@/modules/banks/actions";
import { BankLogo } from "@/modules/banks/components/bank-logo";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";
import { requireCountryScope } from "@/modules/countries/lib";

type Bank = {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  active: boolean;
  logo_path: string | null;
  account_fields: { key: string; label: string }[];
  channels: string[];
};

// One bank: logo, name/code/status, its own extra account fields and which of
// the country's payment channels it supports.
export default async function BankDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("banks", "view");
  const { id } = await params;
  const { error } = await searchParams;
  const { active } = await requireCountryScope();

  const { data } = await db().from("banks").select("*").eq("id", id).maybeSingle();
  const bank = data as Bank | null;
  if (!bank || (active && bank.country_id !== active.id)) notFound();

  const logo = await signedUrl(ASSETS_BUCKET, bank.logo_path);
  const canEdit = Boolean(can(cu, "banks", "edit"));
  const canDelete = Boolean(can(cu, "banks", "delete"));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/banks" className="text-xs text-muted hover:text-foreground">
          ← Banks
        </Link>
        <h1 className="mt-1 flex items-center gap-3 text-xl font-semibold">
          {bank.name}
          {bank.code && <span className="mono-num text-sm text-muted">({bank.code})</span>}
        </h1>
      </div>
      <ErrorBanner message={error} />

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Bank</h2>
        <div className="flex items-center gap-4">
          <BankLogo bankId={bank.id} countryId={bank.country_id} url={logo} canEdit={canEdit} />
          <p className="text-xs text-muted">Click the logo to upload or replace it; hover to remove.</p>
        </div>
        <form action={updateBank} className="grid items-end gap-4 sm:grid-cols-[1fr_8rem_5rem_auto_auto]">
          <input type="hidden" name="id" value={bank.id} />
          <input type="hidden" name="country_id" value={bank.country_id} />
          {(bank.channels ?? []).map((c) => (
            <input key={c} type="hidden" name="channels" value={c} />
          ))}
          <div>
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input name="name" defaultValue={bank.name} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Code</label>
            <input name="code" defaultValue={bank.code ?? ""} className="input mono-num uppercase" disabled={!canEdit} />
          </div>
          <label className="flex items-center gap-2 pb-2 text-xs text-muted">
            <input type="checkbox" name="active" defaultChecked={bank.active} disabled={!canEdit} /> Active
          </label>
          {canEdit && <SaveButton tip="Save this bank" />}
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
      </section>

      <section className="card space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Extra Account Fields</h2>
          <p className="mt-1 text-xs text-muted">
            Asked for whenever a bank account is submitted for {bank.name} (e.g. Company ID, App PIN).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(bank.account_fields ?? []).length === 0 && <p className="text-sm text-muted">None yet.</p>}
          {(bank.account_fields ?? []).map((f) => (
            <form key={f.key} action={removeBankField} className="inline-flex">
              <input type="hidden" name="id" value={bank.id} />
              <input type="hidden" name="country_id" value={bank.country_id} />
              <input type="hidden" name="key" value={f.key} />
              <button
                type="submit"
                disabled={!canEdit}
                title={`Remove ${f.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs text-accent-strong transition-colors hover:border-danger/60 hover:text-danger disabled:opacity-60"
              >
                {f.label} <span className="text-muted">✕</span>
              </button>
            </form>
          ))}
        </div>
        {canEdit && (
          <form action={addBankField} className="flex max-w-sm items-end gap-2">
            <input type="hidden" name="id" value={bank.id} />
            <input type="hidden" name="country_id" value={bank.country_id} />
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">New Field</label>
              <input name="label" placeholder="e.g. Company ID" className="input" required />
            </div>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-accent"
            >
              + Add
            </button>
          </form>
        )}
      </section>

      <AuditLine
        createdBy={(bank as { created_by?: string | null }).created_by}
        createdAt={(bank as { created_at?: string | null }).created_at}
        updatedBy={(bank as { updated_by?: string | null }).updated_by}
        updatedAt={(bank as { updated_at?: string | null }).updated_at}
      />
    </div>
  );
}
