import "server-only";
import { can, type CurrentUser } from "./auth";
import { globalModuleToggles, moduleEnabledFor } from "./settings";
import { activeCountry } from "@/modules/merchants/lib";
import { adminScope } from "@/modules/countries/lib";
import { MODULES } from "@/modules/registry";
import type { NavItem, NavSection } from "@/components/sidebar-nav";

/**
 * The platform back office has two shapes:
 *  - the global console (superadmin only): platform-wide settings, no records
 *  - a country: the operational modules for that country
 * These module keys belong to the console and never show up inside a country.
 */
const GLOBAL_ONLY = new Set(["countries", "telegram"]);

/** Sidebar sections for the current user: permission-, toggle- and scope-filtered. */
export async function navSectionsFor(cu: CurrentUser): Promise<NavSection[]> {
  const toggles = await globalModuleToggles();
  const isMerchant = Boolean(cu.merchant);
  const country = isMerchant ? (await activeCountry(cu)).active : null;
  const isGlobal = !isMerchant && (await adminScope(cu)).mode === "global";

  const canSettings = Boolean(can(cu, "settings", "view"));
  const items: NavItem[] = [];
  for (const m of MODULES) {
    const nav = isMerchant ? m.merchantNav : m.adminNav;
    if (!nav) continue;
    if (!m.core && !moduleEnabledFor(m.key, toggles, cu.merchant, country)) continue;
    if (!can(cu, m.key, "view")) continue;
    if (!isMerchant && m.key !== "settings" && GLOBAL_ONLY.has(m.key) !== isGlobal) continue;
    const item: NavItem = { ...nav };
    // Per-country module settings hang off their module, inside a country only.
    if (!isMerchant && !isGlobal && m.settingsHref && canSettings) {
      const label =
        m.key === "owners" ? "Owner Extra Fields" : m.key === "companies" ? "Shareholder Settings" : "Settings";
      item.children = [{ href: m.settingsHref, label }];
    }
    if (!isMerchant && !isGlobal && m.key === "companies") {
      item.children = [
        { href: "/admin/companies/types", label: "Company Types" },
        ...(item.children ?? []),
      ];
    }
    if (!isMerchant && !isGlobal && m.key === "banks") {
      item.children = [
        { href: "/admin/banks/channels", label: "Payment Channels" },
        { href: "/admin/banks/fields", label: "Bank Account Extra Fields" },
      ];
    }
    if (!isMerchant && !isGlobal && m.key === "notifications") {
      item.label = "App Notification";
      item.children = [{ href: "/admin/notifications/history", label: "Notification History" }];
    }
    if (!isMerchant && !isGlobal && m.key === "wallet") {
      item.children = [
        { href: "/admin/wallets/transactions", label: "Transactions" },
        { href: "/admin/wallets/withdrawals", label: "Withdrawals" },
        { href: "/admin/wallets/rewards", label: "Rewards" },
      ];
    }
    if (!isMerchant && !isGlobal && m.key === "billing") {
      item.children = [
        { href: "/admin/billing/invoices", label: "Invoices" },
        { href: "/admin/billing/turnover", label: "Turnover Review" },
        { href: "/admin/billing/topups", label: "USDT Top-Ups" },
        { href: "/admin/billing/settlements", label: "Settlements" },
      ];
    }
    if (!isMerchant && !isGlobal && m.key === "contracts") {
      item.children = [
        { href: "/admin/contracts/assignments", label: "Assignments" },
        { href: "/admin/contracts/customer-defaults", label: "Customer Defaults" },
        { href: "/admin/contracts/terms", label: "Terms & Conditions" },
        { href: "/admin/contracts/terminations", label: "Termination Requests" },
      ];
    }
    if (!isMerchant && !isGlobal && m.key === "shipping") {
      item.children = [{ href: "/admin/shipping/couriers", label: "Couriers" }];
    }
    if (!isMerchant && !isGlobal && m.key === "tickets") {
      item.children = [{ href: "/admin/tickets/types", label: "Ticket Types" }];
    }
    if (!isMerchant && !isGlobal && m.key === "hr") {
      item.children = [
        { href: "/admin/hr/departments", label: "Departments" },
        { href: "/admin/hr/payroll", label: "Payroll" },
      ];
    }
    if (!isMerchant && !isGlobal && m.key === "expenses") {
      item.children = [
        { href: "/admin/expenses/categories", label: "Categories" },
        { href: "/admin/expenses/items", label: "Items" },
      ];
    }
    if (!isMerchant && !isGlobal && m.key === "exams") {
      item.children = [{ href: "/admin/exams/questions", label: "Question Bank" }];
    }
    if (!isMerchant && !isGlobal && m.key === "owners") {
      item.children = [
        ...(item.children ?? []),
        { href: "/admin/occupations", label: "Occupations" },
        { href: "/admin/occupations/categories", label: "Occupation Categories" },
      ];
    }
    items.push(item);
  }

  // Agents signing in to /m get their own page: earnings, debt, their network.
  if (isMerchant) {
    const { agentForUser } = await import("@/modules/agents/lib");
    if (await agentForUser(cu.user.id)) items.push({ href: "/m/earnings", label: "My Business" });
  }

  const home = isMerchant ? "/m" : "/admin";
  const settingsIdx = items.findIndex((i) => i.href.endsWith("/settings"));
  const settingsItems = settingsIdx >= 0 ? items.splice(settingsIdx, 1) : [];

  const sections: NavSection[] = [
    { items: [{ href: home, label: "Dashboard" }, ...items.filter((i) => !isAdminManage(i.href))] },
  ];
  const manage = items.filter((i) => isAdminManage(i.href));
  if (manage.length) sections.push({ heading: "Access", items: manage });

  if (!isMerchant && !isGlobal && canSettings) {
    // The country you are in has its own settings and module switches.
    sections.push({
      heading: "Country Setting",
      items: [
        {
          href: "/admin/country",
          label: "Countries",
          children: [{ href: "/admin/country/regions", label: "States / Provinces" }],
        },
        { href: "/admin/country/modules", label: "Modules" },
      ],
    });
  }

  if (isGlobal) {
    if (can(cu, "merchants", "view")) {
      sections[0].items.push({ href: "/admin/white-labels", label: "White Labels" });
    }
    if (canSettings) {
      sections.push({
        heading: "Platform",
        items: [
          { href: "/admin/modules", label: "Modules" },
          { href: "/admin/settings", label: "Platform Settings" },
          { href: "/admin/settings/ai", label: "AI Assistant Keys" },
          { href: "/admin/settings/app", label: "Mobile App Releases" },
        ],
      });
    }
  } else if (settingsItems.length) {
    sections.push({ heading: "System", items: settingsItems });
  }
  return sections;
}

function isAdminManage(href: string): boolean {
  return href === "/admin/users" || href === "/admin/roles" || href === "/m/team" || href === "/m/roles";
}
