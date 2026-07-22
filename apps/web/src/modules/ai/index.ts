import type { ModuleDef } from "@/modules/registry";

export const aiModule: ModuleDef = {
  key: "ai",
  name: "AI Assistant",
  description: "Ask questions about your data — answers are scoped to your role and permissions",
  adminNav: { href: "/admin/ai", label: "AI Assistant" },
  merchantNav: { href: "/m/ai", label: "AI Assistant" },
  settingsHref: "/admin/settings/ai",
};
