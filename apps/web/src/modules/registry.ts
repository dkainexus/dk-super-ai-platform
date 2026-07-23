// Module registry — the "plugin" system of this platform template.
//
// A module = one self-contained folder under src/modules/<key>/ holding:
//   index.ts     module definition (this registry imports it)
//   actions.ts   server actions (+ actions-merchant.ts for the /m side)
//   lib.ts       server-side helpers
//   components/  module UI components
//   install.sql  tables + role permissions + toggle (for new deployments)
// plus thin route files under /admin and/or /m that import from the folder.
//
// Registering a module wires up, automatically:
//   - sidebar navigation (permission- and toggle-filtered, settings sub-item)
//   - the Roles permission editor (view/add/edit/delete x scope)
//   - the Modules page on/off switch (global + per-merchant)
//   - a Dashboard stats card
//
// CORE modules keep the platform itself running and cannot be switched off.

import { banksModule } from "@/modules/banks";
import { countriesModule } from "@/modules/countries";
import { merchantsModule } from "@/modules/merchants";
import { telegramModule } from "@/modules/telegram";
import { aiModule } from "@/modules/ai";
import { ownersModule } from "@/modules/owners";
import { companiesModule } from "@/modules/companies";
import { walletModule } from "@/modules/wallet";
import { trainingModule } from "@/modules/training";
import { notificationsModule } from "@/modules/notifications";
import { examsModule } from "@/modules/exams";
import { bankAccountsModule } from "@/modules/bank-accounts";

export type ModuleDef = {
  key: string;
  name: string;
  description: string;
  core?: boolean; // not togglable
  adminNav?: { href: string; label: string };
  merchantNav?: { href: string; label: string };
  /** Platform-side module settings page — shown as a sidebar sub-item and a
   *  "Settings" button on the Modules page. */
  settingsHref?: string;
};

const CORE_MODULES: ModuleDef[] = [
  countriesModule,
  merchantsModule,
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
    description: "Platform settings and branding",
    core: true,
    adminNav: { href: "/admin/settings", label: "Settings" },
    merchantNav: { href: "/m/settings", label: "Branding" },
  },
];

export const MODULES: ModuleDef[] = [
  banksModule,
  telegramModule,
  aiModule,
  ownersModule,
  companiesModule,
  walletModule,
  bankAccountsModule,
  trainingModule,
  notificationsModule,
  examsModule,
  ...CORE_MODULES,
];

export const TOGGLABLE_MODULES = MODULES.filter((m) => !m.core);

export function moduleByKey(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}
