import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { agent } from "@/modules/agents/lib";
import { conditionRows } from "@/modules/contracts/policy";
import { AgentDetail } from "@/modules/agents/components/agent-detail";
import { ConditionTable } from "@/modules/contracts/components/condition-table";

export default async function AdminAgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("agents", "view");
  const { id } = await params;
  const { error, saved } = await searchParams;
  const a = await agent(id);
  if (!a) notFound();

  let conditions: React.ReactNode = null;
  if (a.country_id && can(cu, "contracts", "view")) {
    const [rows, { data: banks }, { data: country }] = await Promise.all([
      conditionRows(a.merchant_id, a.country_id, a.id),
      db().from("banks").select("id, name, code").eq("country_id", a.country_id).eq("active", true).order("sort"),
      db().from("countries").select("payment_channels").eq("id", a.country_id).maybeSingle(),
    ]);
    conditions = (
      <ConditionTable
        rows={rows}
        banks={(banks ?? []) as { id: string; name: string; code?: string | null }[]}
        channels={((country?.payment_channels as string[] | null) ?? []).filter(Boolean)}
        canEdit={Boolean(can(cu, "contracts", "edit"))}
        hidden={{ back: `/admin/agents/${a.id}`, merchant_id: a.merchant_id, country_id: a.country_id }}
        agentId={a.id}
        emptyText="No conditions yet — copy the white label's defaults or add rows."
        showCopy
      />
    );
  }

  return (
    <AgentDetail
      a={a}
      base="/admin/agents"
      ownerBase="/admin/owners"
      canEdit={Boolean(can(cu, "agents", "edit"))}
      canDelete={Boolean(can(cu, "agents", "delete"))}
      error={error}
      saved={saved}
      conditions={conditions}
    />
  );
}
