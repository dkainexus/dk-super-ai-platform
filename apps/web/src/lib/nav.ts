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
    items.push({ ...nav });
  }

  // Branches sub-menu under Banks — only shown once there is something in it
  // (existing branches or app submissions waiting for branch processing).
  if (!isMerchant) {
    const banksItem = items.find((i) => i.href === "/admin/banks");
    if (banksItem) {
      const { db } = await import("./supabase");
      const [{ count: branches }, { count: unprocessed }] = await Promise.all([
        db().from("bank_branches").select("id", { count: "exact", head: true }),
        db()
          .from("bank_accounts")
          .select("id", { count: "exact", head: true })
          .is("branch_id", null)
          .not("branch_map_path", "is", null),
      ]);
      if ((branches ?? 0) > 0 || (unprocessed ?? 0) > 0) {
        banksItem.children = [{ href: "/admin/banks/branches", label: "Branches" }];
      }
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
