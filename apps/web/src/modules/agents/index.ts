import type { ModuleDef } from "@/modules/registry";

// Agents belong to a white label, so on the platform side they live under the
// White Labels menu (see nav.ts) rather than at the top level.
export const agentsModule: ModuleDef = {
  key: "agents",
  name: "Agents",
  description: "People who recruit owners for a white label — they sign in and enter owners themselves",
  merchantNav: { href: "/m/agents", label: "Agents" },
};
