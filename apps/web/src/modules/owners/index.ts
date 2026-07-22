import type { ModuleDef } from "@/modules/registry";

export const ownersModule: ModuleDef = {
  key: "owners",
  name: "Owners",
  description: "Owner records with per-country custom fields and review flow",
  adminNav: { href: "/admin/owners", label: "Owners" },
  merchantNav: { href: "/m/owners", label: "Owners" },
  settingsHref: "/admin/settings/owners",
};
