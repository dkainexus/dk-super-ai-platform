import type { ModuleDef } from "@/modules/registry";

// Internal key/table stays "merchants"; the product name is White Label.
export const merchantsModule: ModuleDef = {
  key: "merchants",
  name: "White Label",
  description: "White label accounts, branding and per-white-label module overrides",
  core: true,
  adminNav: { href: "/admin/merchants", label: "White Labels" },
};
