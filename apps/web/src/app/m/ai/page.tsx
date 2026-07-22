import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { aiSettings, activeKey } from "@/lib/ai";
import { AiChat } from "@/components/ai-chat";

export default async function MerchantAiPage() {
  const { cu } = await requirePerm("ai", "view");
  if (!cu.merchant) redirect("/admin/ai");
  const toggles = await globalModuleToggles();
  if (!moduleEnabledFor("ai", toggles, cu.merchant)) redirect("/m");

  const s = await aiSettings();
  const configured = Boolean(activeKey(s));
  const name = cu.user.name || cu.user.username;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">AI Assistant</h1>
        <p className="mt-1 text-sm text-muted">
          Ask questions about {cu.merchant.name}&apos;s data. Answers only use what your role is allowed to see.
        </p>
      </div>
      <AiChat
        configured={configured}
        greeting={`Hi ${name}! I can answer questions about ${cu.merchant.name}'s data — owners, team members and more. What would you like to know?`}
      />
    </div>
  );
}
