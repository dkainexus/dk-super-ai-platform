import type { ModuleDef } from "@/modules/registry";

export const agentsModule: ModuleDef = {
  key: "agents",
  name: "Agents",
  description: "People who recruit owners for a white label — they sign in and enter owners themselves",
  adminNav: { href: "/admin/agents", label: "Agents" },
  merchantNav: { href: "/m/agents", label: "Agents" },
};
