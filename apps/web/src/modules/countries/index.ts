import type { ModuleDef } from "@/modules/registry";

export const countriesModule: ModuleDef = {
  key: "countries",
  name: "Countries",
  description: "Country workspaces — timezone, currency and the white labels inside them",
  core: true,
  adminNav: { href: "/admin/countries", label: "Countries" },
};
