import Link from "next/link";
import { requireMerchantUser, requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { regionTree, addressLevels } from "@/modules/countries/regions";
import { banksForCountry } from "@/modules/banks/lib";
import { occupationsList } from "@/modules/owners/lib";
import { activeCountry } from "@/modules/merchants/lib";
import { ErrorBanner } from "@/components/error-banner";
import { OwnerForm } from "@/modules/owners/components/owner-form";
import type { CountryField } from "@/lib/types";

// Country is always chosen first — auto-selected when the white label only
// operates in one country.
export default async function NewOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cu = await requireMerchantUser();
  await requirePerm("owners", "add");
  // Owners are entered by the agent who recruited them, nobody else.
  const { agentForUser } = await import("@/modules/agents/lib");
  if (!(await agentForUser(cu.user.id))) {
    const { redirect } = await import("next/navigation");
    redirect("/m/owners");
  }
  const merchant = cu.merchant;
  const { error } = await searchParams;

  // The portal's active country (top-bar switcher) decides the country.
  const { active: country, allowed } = await activeCountry(cu);

  const [{ data: fields }, banks, occupations] = country
    ? await Promise.all([
        db().from("country_fields").select("*").eq("country_id", country.id).eq("active", true).order("sort"),
        banksForCountry(country.id, merchant),
        occupationsList(),
      ])
    : [{ data: [] }, [], []];
  const regions = await regionTree(country?.id ?? "");
  const levels = addressLevels(country as { address_levels?: string[] | null } | null);
  const { data: agentRows } = await db()
    .from("agents")
    .select("id, full_name")
    .eq("status", "active")
    .order("full_name");
  const agentOptions = ((agentRows ?? []) as { id: string; full_name: string }[]).map((a) => ({
    id: a.id,
    name: a.full_name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/m/owners" className="text-xs text-muted hover:text-foreground">
          ← Owners
        </Link>
        <h1 className="mt-1 text-xl font-semibold">New Owner</h1>
      </div>
      <ErrorBanner message={error} />

      {allowed.length === 0 && (
        <p className="card px-5 py-6 text-sm text-muted">
          No countries enabled for your account yet — contact your administrator.
        </p>
      )}

      {country && (
        <div className="card p-5">
          {allowed.length > 1 && (
            <p className="mb-3 text-xs text-muted">
              Creating in {country.flag || "🌐"} {country.name} — switch country from the top bar.
            </p>
          )}
          <OwnerForm
            levels={levels}
            regions={regions}
            agents={agentOptions}
            fields={(fields ?? []) as CountryField[]}
            banks={banks}
            occupations={occupations}
            hidden={{ country_id: country.id }}
            contract={await (await import("@/modules/contracts/policy")).ownerContractSection(
              cu.merchant.id,
              country.id,
              null
            )}
          />
        </div>
      )}
    </div>
  );
}
