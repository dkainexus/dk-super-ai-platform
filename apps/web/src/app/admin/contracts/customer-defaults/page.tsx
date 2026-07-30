import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { customerConditionRows } from "@/modules/contracts/customer-policy";
import { ConditionTable } from "@/modules/contracts/components/condition-table";
import { ErrorBanner } from "@/components/error-banner";

// The platform's default customer conditions: what a worker assigns at
// without having to think. Every new (platform) customer starts on a copy.
export default async function CustomerDefaultsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("contracts", "view");
  const { error, saved } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const [rows, { data: banks }, { data: country }] = await Promise.all([
    customerConditionRows(active.id, null),
    db().from("banks").select("id, name, code").eq("country_id", active.id).eq("active", true).order("sort"),
    db().from("countries").select("payment_channels").eq("id", active.id).maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/contracts" className="text-xs text-muted hover:text-foreground">← Contracts</Link>
        <h1 className="mt-1 text-xl font-semibold">Customer Defaults — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Our standard customer pricing, bank by bank. New customers start on a copy of this table; each
          customer&apos;s copy can then be negotiated on their own page. Assignments always price from the
          customer&apos;s table — never from a worker&apos;s memory.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">Saved.</p>
      )}

      <section className="card p-5">
        <ConditionTable
          kind="customer"
          rows={rows}
          banks={(banks ?? []) as { id: string; name: string; code?: string | null }[]}
          channels={((country?.payment_channels as string[] | null) ?? []).filter(Boolean)}
          canEdit={Boolean(can(cu, "contracts", "edit"))}
          hidden={{ back: "/admin/contracts/customer-defaults", country_id: active.id }}
          emptyText="No default rows yet — add the first below."
        />
      </section>
    </div>
  );
}
