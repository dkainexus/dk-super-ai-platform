import { redirect } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { activeCountry } from "@/modules/merchants/lib";
import { agents } from "@/modules/agents/lib";
import { AgentsList } from "@/modules/agents/components/agents-list";

export default async function MerchantAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("agents", "view");
  if (!cu.merchant) redirect("/admin/agents");
  const { active } = await activeCountry(cu);
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("agents", toggles, cu.merchant, active)) redirect("/m");
  const { error } = await searchParams;

  const rows = await agents({ merchantId: cu.merchant.id, countryId: active?.id });

  return (
    <AgentsList
      base="/m/agents"
      rows={rows}
      error={error}
      canAdd={Boolean(can(cu, "agents", "add"))}
      where={active?.name ?? null}
      showMerchant={false}
    />
  );
}
