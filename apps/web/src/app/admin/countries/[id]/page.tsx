import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import {
  createCountryField,
  updateCountryField,
  deleteCountryField,
  createMerchant,
} from "@/app/actions/cms";
import { ErrorBanner } from "@/components/error-banner";
import { ActiveTag } from "@/components/status-tag";
import { SaveButton, SubmitButton } from "@/components/action-buttons";
import type { Country, CountryField, Merchant } from "@/lib/types";

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  file: "File Upload",
  select: "Select",
};

export default async function CountryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("countries", "view");
  const { id } = await params;
  const { error } = await searchParams;

  const { data: country } = await db().from("countries").select("*").eq("id", id).maybeSingle();
  if (!country) notFound();
  const c = country as Country;

  const [{ data: merchants }, { data: fields }] = await Promise.all([
    db()
      .from("merchants")
      .select("*, users(count), owners(count)")
      .eq("country_id", id)
      .order("created_at"),
    db().from("country_fields").select("*").eq("country_id", id).order("sort"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/countries" className="text-xs text-muted hover:text-foreground">
          ← Countries
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {c.flag || "🌐"} {c.name} <span className="mono-num text-sm text-muted">{c.code}</span>
        </h1>
      </div>
      <ErrorBanner message={error} />

      {/* ---------- Merchants ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Merchants</h2>
        <div className="card divide-y divide-border">
          {(merchants ?? []).length === 0 && (
            <p className="px-5 py-6 text-sm text-muted">No merchants in this country yet.</p>
          )}
          {(merchants ?? []).map(
            (m: Merchant & { users: { count: number }[]; owners: { count: number }[] }) => (
              <Link
                key={m.id}
                href={`/admin/merchants/${m.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-surface-raised"
              >
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted">
                    {m.subdomain ? `${m.subdomain}.***` : "no subdomain"} · {m.users?.[0]?.count ?? 0} account(s) ·{" "}
                    {m.owners?.[0]?.count ?? 0} owner(s)
                  </p>
                </div>
                <ActiveTag active={m.status === "active"} on="Active" off="Suspended" />
              </Link>
            )
          )}
        </div>

        <div className="card mt-4 p-5">
          <h3 className="mb-4 text-sm font-semibold">Create Merchant + Login Account</h3>
          <form action={createMerchant} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="country_id" value={c.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Merchant Name</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Subdomain (optional, lowercase a-z 0-9 -)</label>
              <input name="subdomain" placeholder="merchant-a" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Login Username</label>
              <input name="username" autoComplete="off" className="input mono-num" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Initial Password (must be changed at first login)</label>
              <input name="password" type="text" autoComplete="off" className="input mono-num" required />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton label="Create Merchant" />
            </div>
          </form>
        </div>
      </section>

      {/* ---------- Custom fields ---------- */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Owner Custom Fields (apply to {c.name} only)
        </h2>
        <p className="mb-3 text-xs text-muted">
          Built-in fields: full name, ID number, ID front, ID back. Fields added here automatically appear on every owner form in this country — e.g. Tabien Baan for Thailand.
        </p>
        <div className="space-y-3">
          {(fields ?? []).map((f: CountryField) => (
            <div key={f.id} className="card p-4">
              <form action={updateCountryField} className="grid items-end gap-3 sm:grid-cols-[1fr_7rem_5rem_5rem_auto_auto]">
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="country_id" value={c.id} />
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    Label <span className="mono-num">({f.field_key} · {FIELD_TYPE_LABEL[f.field_type]})</span>
                  </label>
                  <input name="label" defaultValue={f.label} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Sort</label>
                  <input name="sort" type="number" defaultValue={f.sort} className="input mono-num" />
                </div>
                <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                  <input type="checkbox" name="required" defaultChecked={f.required} /> Required
                </label>
                <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                  <input type="checkbox" name="active" defaultChecked={f.active} /> Enabled
                </label>
                <SaveButton />
                <button
                  type="submit"
                  formAction={deleteCountryField}
                  className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  Delete
                </button>
              </form>
              {f.field_type === "select" && (
                <p className="mt-2 text-xs text-muted">Options: {(f.options ?? []).join(" / ")}</p>
              )}
            </div>
          ))}
        </div>

        <div className="card mt-4 p-5">
          <h3 className="mb-4 text-sm font-semibold">Add Field</h3>
          <form action={createCountryField} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="country_id" value={c.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Field Label (shown to merchants)</label>
              <input name="label" placeholder="Tabien Baan" className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Field key (optional, auto-generated)</label>
              <input name="field_key" placeholder="tabien_baan" className="input mono-num" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Type</label>
              <select name="field_type" className="input">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="file">File Upload</option>
                <option value="select">Select</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Options (select type only, comma separated)</label>
              <input name="options" placeholder="Option A, Option B" className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" name="required" /> Required field
            </label>
            <div className="sm:col-span-2">
              <SubmitButton label="Add Field" />
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
