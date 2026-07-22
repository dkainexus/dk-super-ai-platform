import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { aiSettings, activeKey } from "@/lib/ai";
import { AiChat } from "@/components/ai-chat";

export default async function AdminAiPage() {
  const { cu } = await requirePerm("ai", "view");
  const s = await aiSettings();
  const configured = Boolean(activeKey(s));
  const name = cu.user.name || cu.user.username;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">AI Assistant</h1>
          <p className="mt-1 text-sm text-muted">
            Ask questions about your data. Answers only use what your role is allowed to see.
          </p>
        </div>
        {can(cu, "settings", "edit") && (
          <Link
            href="/admin/settings/ai"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent"
            title="Configure provider and API keys"
          >
            AI Settings →
          </Link>
        )}
      </div>
      <AiChat
        configured={configured}
        greeting={`Hi ${name}! I can answer questions about the platform data you have access to — owners, merchants, banks, users and more. What would you like to know?`}
      />
    </div>
  );
}
