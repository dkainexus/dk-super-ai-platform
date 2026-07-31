import { requirePerm, can } from "@/lib/auth";
import { agentPage } from "@/modules/agents/lib";
import { AgentsList } from "@/modules/agents/components/agents-list";
import { requireCountryScope } from "@/modules/countries/lib";
import { pageParams } from "@/components/pagination";

// Agents recruit owners for a white label. Each one signs in and enters the
// owners they bring in, so every owner records who introduced them.
export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; q?: string; page?: string; per?: string }>;
}) {
  const { cu } = await requirePerm("agents", "view");
  const sp = await searchParams;
  const { error, status = "", q = "" } = sp;
  const { page, perPage, from, to } = pageParams(sp);
  const { active } = await requireCountryScope();
  const { rows, total } = await agentPage({ countryId: active?.id, status, q, from, to });

  return (
    <AgentsList
      base="/admin/agents"
      rows={rows}
      total={total}
      page={page}
      perPage={perPage}
      status={status}
      q={q}
      error={error}
      canAdd={Boolean(can(cu, "agents", "add"))}
      where={active?.name ?? null}
    />
  );
}
