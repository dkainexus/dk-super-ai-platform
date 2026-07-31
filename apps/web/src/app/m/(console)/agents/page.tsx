import { redirect } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { activeCountry } from "@/modules/merchants/lib";
import { agentPage } from "@/modules/agents/lib";
import { AgentsList } from "@/modules/agents/components/agents-list";
import { pageParams } from "@/components/pagination";

export default async function MerchantAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; q?: string; page?: string; per?: string }>;
}) {
  const { cu } = await requirePerm("agents", "view");
  if (!cu.merchant) redirect("/admin/agents");
  const { active } = await activeCountry(cu);
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("agents", toggles, cu.merchant, active)) redirect("/m");
  const sp = await searchParams;
  const { error, status = "", q = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);

  const { rows, total } = await agentPage({ merchantId: cu.merchant.id, countryId: active?.id, status, q, from, to });

  return (
    <AgentsList
      base="/m/agents"
      rows={rows}
      total={total}
      page={page}
      perPage={perPage}
      status={status}
      q={q}
      error={error}
      canAdd={Boolean(can(cu, "agents", "add"))}
      where={active?.name ?? null}
      showMerchant={false}
    />
  );
}
