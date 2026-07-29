import "server-only";
import { can, type CurrentUser } from "./auth";
import { db } from "./supabase";
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

  // Entity sub-menus: the things that live inside each module, so you can jump
  // straight to the one you want instead of hunting through the list page.
  if (!isMerchant) {
    const [countries, merchants] = await Promise.all([
      db().from("countries").select("id, name, flag").eq("active", true).order("sort").order("name"),
      db().from("merchants").select("id, name").eq("status", "active").order("name"),
    ]);
    const countryItems = ((countries.data ?? []) as { id: string; name: string; flag: string | null }[]).map((c) => ({
      id: c.id,
      label: `${c.flag ?? ""} ${c.name}`.trim(),
    }));

    const attach = (href: string, children: NavItem[]) => {
      const item = items.find((i) => i.href === href);
      if (item && children.length) item.children = [...(item.children ?? []), ...children];
    };

    attach("/admin/training", [{ href: "/admin/settings/app", label: "App Releases" }]);
    attach("/admin/countries", countryItems.map((c) => ({ href: `/admin/countries/${c.id}`, label: c.label })));
    attach("/admin/banks", countryItems.map((c) => ({ href: `/admin/banks?country=${c.id}`, label: c.label })));
    attach(
      "/admin/merchants",
      ((merchants.data ?? []) as { id: string; name: string }[]).map((m) => ({
        href: `/admin/merchants/${m.id}`,
        label: m.name,
      }))
    );
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
