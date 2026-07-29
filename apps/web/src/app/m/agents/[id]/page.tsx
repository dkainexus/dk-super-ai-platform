import { notFound, redirect } from "next/navigation";
import { requirePerm, can } from "@/lib/auth";
import { agent } from "@/modules/agents/lib";
import { AgentDetail } from "@/modules/agents/components/agent-detail";

export default async function MerchantAgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { cu } = await requirePerm("agents", "view");
  if (!cu.merchant) redirect("/admin/agents");
  const { id } = await params;
  const { error, saved } = await searchParams;
  const a = await agent(id);
  if (!a || a.merchant_id !== cu.merchant.id) notFound();

  return (
    <AgentDetail
      a={a}
      base="/m/agents"
      ownerBase="/m/owners"
      canEdit={Boolean(can(cu, "agents", "edit"))}
      canDelete={Boolean(can(cu, "agents", "delete"))}
      error={error}
      saved={saved}
    />
  );
}
