import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createCustomer } from "@/modules/customers/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { SubmitButton } from "@/components/action-buttons";
import { MoneyInput } from "@/components/money-input";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("customers", "add");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data: merchants } = await db()
    .from("merchants")
    .select("id, name, merchant_countries(country_id)")
    .eq("status", "active")
    .order("name");
  const list = ((merchants ?? []) as unknown as {
    id: string;
    name: string;
    merchant_countries: { country_id: string }[];
  }[]).filter((m) => m.merchant_countries.some((c) => c.country_id === active.id));

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/customers" className="text-xs text-muted hover:text-foreground">← Customers</Link>
        <h1 className="mt-1 text-xl font-semibold">New Customer</h1>
        <p className="mt-1 text-sm text-muted">
          In {active.flag || "🌐"} {active.name}. The insurance is written into the agreement, never collected —
          it caps what we compensate if an account is robbed.
        </p>
      </div>
      <ErrorBanner message={error} />

      <form action={createCustomer} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">White Label *</label>
          <select name="merchant_id" className="input" required>
            <option value="">— Select a white label —</option>
            {list.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Customer Name *</label>
          <input name="name" className="input" required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Company Name</label>
          <input name="company_name" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Contact Person</label>
          <input name="contact_name" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Email</label>
          <input name="email" type="email" className="input" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Belongs To</label>
          <select name="belongs_to" className="input">
            <option value="platform">Us — we carry their losses</option>
            <option value="white_label">The white label — they carry their losses</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Insurance (written, not collected)</label>
          <MoneyInput name="deposit" defaultValue={0} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Setup Fee (per account, once)</label>
          <MoneyInput name="setup_fee" defaultValue={0} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">Notes</label>
          <textarea name="notes" rows={2} className="input" />
        </div>
        <div className="sm:col-span-2">
          <SubmitButton label="Create Customer" />
        </div>
      </form>
    </div>
  );
}
