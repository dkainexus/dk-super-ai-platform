import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { createAgent } from "@/modules/agents/actions";
import { requireCountryScope } from "@/modules/countries/lib";
import { ErrorBanner } from "@/components/error-banner";
import { SubmitButton } from "@/components/action-buttons";

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("agents", "add");
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
        <Link href="/admin/agents" className="text-xs text-muted hover:text-foreground">← Agents</Link>
        <h1 className="mt-1 text-xl font-semibold">New Agent</h1>
        <p className="mt-1 text-sm text-muted">
          Recruiting for a white label in {active.flag || "🌐"} {active.name}. Issue their sign-in on the next screen.
        </p>
      </div>
      <ErrorBanner message={error} />

      <form action={createAgent} className="card grid gap-4 p-5 sm:grid-cols-2">
        <input type="hidden" name="country_id" value={active.id} />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">White Label</label>
          <select name="merchant_id" className="input" required>
            <option value="">— Select a white label —</option>
            {list.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Full Name</label>
          <input name="full_name" className="input" required />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">Email</label>
          <input name="email" type="email" className="input" />
        </div>
        <div className="sm:col-span-2">
          <SubmitButton label="Create Agent" />
        </div>
      </form>
    </div>
  );
}
