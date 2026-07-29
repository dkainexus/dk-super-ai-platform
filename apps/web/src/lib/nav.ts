import "server-only";
import { can, type CurrentUser } from "./auth";
import { globalModuleToggles, moduleEnabledFor } from "./settings";
import { activeCountry } from "@/modules/merchants/lib";
import { MODULES } from "@/modules/registry";
import type { NavItem, NavSection } from "@/components/sidebar-nav";

/** Sidebar sections for the current user: permission- and toggle-filtered. */
export async function navSectionsFor(cu: CurrentUser): Promise<NavSection[]> {
  const toggles = await globalModuleToggles();
  const isMerchant = Boolean(cu.merchant);
  const country = isMerchant ? (await activeCountry(cu)).active : null;

  const canSettings = Boolean(can(cu, "settings", "view"));
  const items: NavItem[] = [];
  for (const m of MODULES) {
    const nav = isMerchant ? m.merchantNav : m.adminNav;
    if (!nav) continue;
    if (!m.core && !moduleEnabledFor(m.key, toggles, cu.merchant, country)) continue;
    if (!can(cu, m.key, "view")) continue;
    const item: NavItem = { ...nav };
    // Module settings live under their own module, not buried in Settings.
    if (!isMerchant && m.settingsHref && canSettings) {
      item.children = [{ href: m.settingsHref, label: "Settings" }];
    }
    items.push(item);
  }

  // Training's release page has no home of its own — hang it off the module.
  if (!isMerchant) {
    const training = items.find((i) => i.href === "/admin/training");
    if (training && canSettings) {
      training.children = [...(training.children ?? []), { href: "/admin/settings/app", label: "App Releases" }];
    }
  }

  const home = isMerchant ? "/m" : "/admin";
  const settingsIdx = items.findIndex((i) => i.href.endsWith("/settings"));
  const settingsItems = settingsIdx >= 0 ? items.splice(settingsIdx, 1) : [];

  const sections: NavSection[] = [
    { items: [{ href: home, label: "Dashboard" }, ...items.filter((i) => !isAdminManage(i.href))] },
  ];
  const manage = items.filter((i) => isAdminManage(i.href));
  if (manage.length) sections.push({ heading: "Access", items: manage });
  if (settingsItems.length) {
    const system: NavItem[] = [...settingsItems];
    if (!isMerchant && canSettings) system.unshift({ href: "/admin/modules", label: "Modules" });
    sections.push({ heading: "System", items: system });
  }
  return sections;
}

function isAdminManage(href: string): boolean {
  return href === "/admin/users" || href === "/admin/roles" || href === "/m/team" || href === "/m/roles";
}
