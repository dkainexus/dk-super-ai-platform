// Module registry — the "plugin" system of this platform template.
//
// A module = one entry here + a route folder under /admin and/or /m.
// Registering it wires up, automatically:
//   - sidebar navigation (permission- and toggle-filtered)
//   - the Roles permission editor (view/add/edit/delete x scope)
//   - the Settings > Modules on/off switch (global + per-merchant)
//   - a Dashboard stats card
//
// CORE modules keep the platform itself running and cannot be switched off.

export type ModuleDef = {
  key: string;
  name: string;
  description: string;
  core?: boolean; // not togglable
  adminNav?: { href: string; label: string };
  merchantNav?: { href: string; label: string };
};

export const MODULES: ModuleDef[] = [
  {
    key: "banks",
    name: "Banks",
    description: "Per-country bank directory used across the platform",
    adminNav: { href: "/admin/banks", label: "Banks" },
  },
  {
    key: "owners",
    name: "Owners",
    description: "Owner records with per-country custom fields and review flow",
    adminNav: { href: "/admin/owners", label: "Owners" },
    merchantNav: { href: "/m/owners", label: "Owners" },
  },
  {
    key: "countries",
    name: "Countries",
    description: "Countries, merchants under them and per-country field config",
    core: true,
    adminNav: { href: "/admin/countries", label: "Countries" },
  },
  {
    key: "merchants",
    name: "Merchants",
    description: "Merchant accounts, branding and per-merchant module overrides",
    core: true,
  },
  {
    key: "users",
    name: "Users",
    description: "User accounts and role assignment",
    core: true,
    adminNav: { href: "/admin/users", label: "Users" },
    merchantNav: { href: "/m/team", label: "Team" },
  },
  {
    key: "roles",
    name: "Roles",
    description: "Custom roles and their permissions",
    core: true,
    adminNav: { href: "/admin/roles", label: "Roles" },
    merchantNav: { href: "/m/roles", label: "Team Roles" },
  },
  {
    key: "settings",
    name: "Settings",
    description: "Platform settings, module toggles and branding",
    core: true,
    adminNav: { href: "/admin/settings", label: "Settings" },
    merchantNav: { href: "/m/settings", label: "Branding" },
  },
];

export const TOGGLABLE_MODULES = MODULES.filter((m) => !m.core);

export function moduleByKey(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}
