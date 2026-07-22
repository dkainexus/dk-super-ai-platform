"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };
export type NavSection = { heading?: string; items: NavItem[] };

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
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-accent-soft font-medium text-accent-strong"
                      : "text-muted hover:bg-surface-raised hover:text-foreground"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      active ? "bg-accent" : "bg-border"
                    }`}
                  />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
