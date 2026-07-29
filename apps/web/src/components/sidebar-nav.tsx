"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; children?: NavItem[] };
export type NavSection = { heading?: string; items: NavItem[] };


// One glyph per destination — matched on href so both /admin and /m map to the
// same visual language.
const ICONS: Record<string, string> = {
  dashboard: "M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-5H3v5Zm11-13h7V3h-7v5Z",
  owners: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11",
  companies: "M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01",
  banks: "M3 10h18M5 10V21M19 10V21M3 21h18M12 3 2 8h20L12 3Z",
  bankAccounts: "M3 7h18v12H3zM3 11h18M7 15h4",
  wallet: "M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0V6a2 2 0 0 1 2-2h11M17 13h.01",
  training: "m10 8 6 4-6 4V8Z M3 5h18v14H3z",
  exams: "M9 11l3 3 5-5M6 3h12a1 1 0 0 1 1 1v16l-7-3-7 3V4a1 1 0 0 1 1-1Z",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  merchants: "M4 7h16l-1 4a3 3 0 0 1-6 0 3 3 0 0 1-6 0L4 7Zm1 5v9h14v-9M3 7l2-4h14l2 4",
  countries: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87",
  roles: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  telegram: "m22 2-7 20-4-9-9-4 20-7Z",
  ai: "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  modules: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4 0a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 7.26 19.4l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06A2 2 0 1 1 7.37 6.1l.06.06A1.65 1.65 0 0 0 9.25 6.5V6a2 2 0 1 1 4 0v.09c0 .66.39 1.26 1 1.51.6.25 1.3.12 1.77-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 13H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
};

function iconFor(href: string): string {
  if (href === "/admin" || href === "/m") return ICONS.dashboard;
  if (href.includes("bank-accounts")) return ICONS.bankAccounts;
  if (href.includes("/banks")) return ICONS.banks;
  if (href.includes("/owners")) return ICONS.owners;
  if (href.includes("/companies")) return ICONS.companies;
  if (href.includes("/wallets")) return ICONS.wallet;
  if (href.includes("/training")) return ICONS.training;
  if (href.includes("/exams")) return ICONS.exams;
  if (href.includes("/notifications")) return ICONS.notifications;
  if (href.includes("/merchants")) return ICONS.merchants;
  if (href.includes("/countries")) return ICONS.countries;
  if (href.includes("/users") || href.includes("/team")) return ICONS.users;
  if (href.includes("/roles")) return ICONS.roles;
  if (href.includes("/telegram")) return ICONS.telegram;
  if (href.includes("/ai")) return ICONS.ai;
  if (href.includes("/modules")) return ICONS.modules;
  return ICONS.settings;
}

function NavIcon({ href }: { href: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={iconFor(href)} />
    </svg>
  );
}

export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin" || href === "/m") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="space-y-6">
      {sections.map((section, i) => (
        <div key={i}>
          {section.heading && (
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
              {section.heading}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((l) => {
              const active = isActive(l.href);
              const childActive = (l.children ?? []).some((c) => isActive(c.href));
              return (
                <div key={l.href}>
                  <Link
                    href={l.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-accent-soft font-medium text-accent-strong"
                        : "text-muted hover:bg-surface-raised hover:text-foreground"
                    }`}
                  >
                    <NavIcon href={l.href} />
                    {l.label}
                  </Link>
                  {(l.children ?? []).length > 0 && (
                  <div
                    className={`overflow-hidden transition-all ${
                      active || childActive ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                  {(l.children ?? []).map((c) => {
                    const cActive = isActive(c.href);
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`ml-4 flex items-center gap-2 rounded-lg border-l border-border py-1.5 pl-4 pr-3 text-xs transition-colors ${
                          cActive
                            ? "border-accent font-medium text-accent-strong"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        {c.label}
                      </Link>
                    );
                  })}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
