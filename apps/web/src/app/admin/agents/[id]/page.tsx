import { notFound } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { agent } from "@/modules/agents/lib";
import { AgentDetail } from "@/modules/agents/components/agent-detail";

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

  return (
    <AgentDetail
      a={a}
      base="/admin/agents"
      ownerBase="/admin/owners"
      canEdit={Boolean(can(cu, "agents", "edit"))}
      canDelete={Boolean(can(cu, "agents", "delete"))}
      error={error}
      saved={saved}
    />
  );
}
