import { requirePerm, can } from "@/lib/auth";
import { agents } from "@/modules/agents/lib";
import { AgentsList } from "@/modules/agents/components/agents-list";
import { requireCountryScope } from "@/modules/countries/lib";

// Agents recruit owners for a white label. Each one signs in and enters the
// owners they bring in, so every owner records who introduced them.
export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("agents", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  const rows = await agents({ countryId: active?.id });

  return (
    <AgentsList
      base="/admin/agents"
      rows={rows}
      error={error}
      canAdd={Boolean(can(cu, "agents", "add"))}
      where={active?.name ?? null}
    />
  );
}
