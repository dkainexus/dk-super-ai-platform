import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { activeCountry } from "@/modules/merchants/lib";
import { createAgent } from "@/modules/agents/actions";
import { ErrorBanner } from "@/components/error-banner";
import { SubmitButton } from "@/components/action-buttons";

export default async function MerchantNewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("agents", "add");
  if (!cu.merchant) redirect("/admin/agents/new");
  const { active } = await activeCountry(cu);
  const { error } = await searchParams;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/m/agents" className="text-xs text-muted hover:text-foreground">← Agents</Link>
        <h1 className="mt-1 text-xl font-semibold">New Agent</h1>
        <p className="mt-1 text-sm text-muted">
          Recruiting for {cu.merchant.name}
          {active ? ` in ${active.flag || "🌐"} ${active.name}` : ""}. Issue their sign-in on the next screen.
        </p>
      </div>
      <ErrorBanner message={error} />

      <form action={createAgent} className="card grid gap-4 p-5 sm:grid-cols-2">
        <input type="hidden" name="country_id" value={active?.id ?? ""} />
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
