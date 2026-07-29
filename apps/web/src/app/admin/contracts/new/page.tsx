import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { NewContractForm, type PartyOption } from "@/modules/contracts/components/new-contract-form";
import { ErrorBanner } from "@/components/error-banner";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("contracts", "add");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const [{ data: customers }, { data: agents }, { data: owners }] = await Promise.all([
    db()
      .from("customers")
      .select("id, name, ref, merchant:merchants(name)")
      .eq("country_id", active.id)
      .eq("status", "active")
      .order("name"),
    db()
      .from("agents")
      .select("id, full_name, ref, merchant:merchants(name)")
      .eq("country_id", active.id)
      .eq("status", "active")
      .order("full_name"),
    db()
      .from("owners")
      .select("id, full_name, ref, merchant:merchants(name)")
      .eq("country_id", active.id)
      .neq("status", "banned")
      .order("full_name"),
  ]);

  const opt = (id: string, label: string | null, ref: string | null, merchant: { name: string } | null): PartyOption => ({
    id,
    label: `${label ?? "(no name)"}${ref ? ` · ${ref}` : ""}`,
    merchant: merchant?.name ?? "—",
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin/contracts" className="text-xs text-muted hover:text-foreground">← Contracts</Link>
        <h1 className="mt-1 text-xl font-semibold">New Contract</h1>
        <p className="mt-1 text-sm text-muted">
          In {active.flag || "🌐"} {active.name}. Accounts and their rents are added on the next screen; the term
          starts on the 1st of the month after the first account does.
        </p>
      </div>
      <ErrorBanner message={error} />

      <NewContractForm
        customers={((customers ?? []) as unknown as { id: string; name: string; ref: string | null; merchant: { name: string } | null }[]).map((c) =>
          opt(c.id, c.name, c.ref, c.merchant)
        )}
        agents={((agents ?? []) as unknown as { id: string; full_name: string; ref: string | null; merchant: { name: string } | null }[]).map((a) =>
          opt(a.id, a.full_name, a.ref, a.merchant)
        )}
        owners={((owners ?? []) as unknown as { id: string; full_name: string | null; ref: string | null; merchant: { name: string } | null }[]).map((o) =>
          opt(o.id, o.full_name, o.ref, o.merchant)
        )}
      />
    </div>
  );
}
