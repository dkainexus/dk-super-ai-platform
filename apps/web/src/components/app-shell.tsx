"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
/* eslint-disable @next/next/no-img-element -- logos/avatars come from signed Supabase URLs */
import { NavIcon, SidebarNav, type NavSection } from "@/components/sidebar-nav";

export type ShellBrand = {
  name: string;
  logoUrl?: string | null;
  /** Square mark for the compact mobile bar (usually the favicon). */
  iconUrl?: string | null;
  homeHref: string;
  /** Small wordmark under the name; derived from homeHref when omitted. */
  sub?: string;
};

export type ShellUser = {
  label: string;
  sub?: string | null; // role / merchant name
  avatarUrl?: string | null;
};

function Brand({ brand, onClick }: { brand: ShellBrand; onClick?: () => void }) {
  const sub =
    brand.sub ??
    (brand.homeHref === "/m" ? "Partner Console" : brand.homeHref === "/admin" ? "Admin Console" : "Customer Portal");
  // The logo is a horizontal wordmark and sits above the name + console line.
  return (
    <Link href={brand.homeHref} onClick={onClick} className="block min-w-0 px-2 py-1">
      {brand.logoUrl && (
        <img
          src={brand.logoUrl}
          alt=""
          className="mb-1.5 h-9 w-auto max-w-full object-contain object-left"
        />
      )}
      <span className="block truncate text-[15px] font-semibold leading-tight tracking-[0.08em] text-foreground">
        {brand.name}
      </span>
      <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{sub}</span>
    </Link>
  );
}

function Avatar({ user, size = 28 }: { user: ShellUser; size?: number }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />;
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong"
    >
      {user.label.slice(0, 2).toUpperCase()}
    </span>
  );
}

function UserMenu({
  user,
  logoutAction,
  settingsHref,
  compact = false,
}: {
  user: ShellUser;
  logoutAction: () => Promise<void>;
  settingsHref?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "flex items-center rounded-full transition-opacity active:opacity-70"
            : "flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:border-accent"
        }
      >
        <Avatar user={user} size={compact ? 32 : 28} />
        {!compact && (
          <>
            <span className="max-w-32 truncate text-sm">{user.label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium">{user.label}</p>
            {user.sub && <p className="truncate text-xs text-muted">{user.sub}</p>}
          </div>
          <Link href="/profile" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-raised">
            My Profile
          </Link>
          {settingsHref && (
            <Link
              href={settingsHref}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-raised"
            >
              Settings
            </Link>
          )}
          <form action={logoutAction}>
            <button type="submit" className="w-full px-4 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/10">
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// The app's bottom tab bar: the first few destinations as tabs, everything
// else behind the Menu tab that opens the full-screen menu page.
function MobileTabBar({
  sections,
  menuOpen,
  onMenu,
}: {
  sections: NavSection[];
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const pathname = usePathname();

  // Fixed tab set — Dashboard, Owner, Company, Account (bank account) — with
  // short native-style labels; anything the audience lacks is topped up from
  // the start of their menu.
  const flat = sections.flatMap((s) => s.items);
  const wanted: { match: (h: string) => boolean; label: string }[] = [
    { match: (h) => h === "/admin" || h === "/m" || h === "/portal", label: "Dashboard" },
    { match: (h) => h.includes("/owners"), label: "Owner" },
    { match: (h) => h.includes("/companies"), label: "Company" },
    { match: (h) => h.includes("/bank-accounts"), label: "Account" },
  ];
  const tabs: { href: string; label: string }[] = [];
  for (const w of wanted) {
    const item = flat.find((i) => w.match(i.href));
    if (item) tabs.push({ href: item.href, label: w.label });
  }
  for (const i of flat) {
    if (tabs.length >= 4) break;
    if (!tabs.some((t) => t.href === i.href)) tabs.push(i);
  }

  function isActive(href: string) {
    if (href === "/admin" || href === "/m" || href === "/portal") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur md:hidden">
      <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => {
          const active = !menuOpen && isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors active:opacity-70 ${
                active ? "text-accent-strong" : "text-muted"
              }`}
            >
              <NavIcon href={t.href} size={20} />
              <span className="max-w-full truncate px-1">{t.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMenu}
          className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors active:opacity-70 ${
            menuOpen ? "text-accent-strong" : "text-muted"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}

// The Menu tab's destination: a native-style full-screen page of grouped,
// icon-tiled rows — not a desktop drawer. The tab bar stays visible below.
function MobileMenuPage({
  sections,
  sidebarExtra,
  onClose,
}: {
  sections: NavSection[];
  sidebarExtra?: React.ReactNode;
  onClose: () => void;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin" || href === "/m" || href === "/portal") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  function Row({ item, child = false }: { item: { href: string; label: string }; child?: boolean }) {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={`flex items-center gap-3 px-4 py-3 transition-colors active:bg-surface-raised ${child ? "pl-14" : ""}`}
      >
        {!child && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              active ? "bg-accent text-white" : "bg-surface-raised text-accent-strong"
            }`}
          >
            <NavIcon href={item.href} size={16} />
          </span>
        )}
        <span className={`min-w-0 flex-1 truncate text-sm ${child ? "text-muted" : "font-medium"} ${active ? "text-accent-strong" : ""}`}>
          {item.label}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>
    );
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
      <h2 className="px-1 pb-4 pt-2 text-2xl font-bold tracking-tight">Menu</h2>
      {sidebarExtra && <div className="mb-4 px-1">{sidebarExtra}</div>}
      {sections.map((section, i) => (
        <div key={i} className="mb-4">
          {section.heading && (
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{section.heading}</p>
          )}
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {section.items.flatMap((item) => [
              <Row key={item.href} item={item} />,
              ...(item.children ?? []).map((c) => <Row key={c.href} item={c} child />),
            ])}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AppShell({
  brand,
  sections,
  user,
  logoutAction,
  headerExtra,
  sidebarExtra,
  settingsHref,
  children,
}: {
  brand: ShellBrand;
  sections: NavSection[];
  user: ShellUser;
  logoutAction: () => Promise<void>;
  headerExtra?: React.ReactNode;
  sidebarExtra?: React.ReactNode;
  settingsHref?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating anywhere puts the menu page away, like a native More tab.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-5 backdrop-blur md:flex">
        <div className="mb-4">
          <Brand brand={brand} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav sections={sections} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-border bg-surface/70 px-6 py-2.5 backdrop-blur md:flex">
          <div className="min-w-52">{sidebarExtra}</div>
          <div className="flex items-center gap-3">
            {headerExtra}
            <UserMenu user={user} logoutAction={logoutAction} settingsHref={settingsHref} />
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-border bg-surface/90 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Link href={brand.homeHref} className="flex min-w-0 flex-1 items-center gap-2.5">
            {brand.iconUrl ? (
              <img src={brand.iconUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#8b5cf6] text-xs font-bold text-white">
                {brand.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-[15px] font-semibold tracking-[0.04em]">{brand.name}</span>
          </Link>
          <UserMenu user={user} logoutAction={logoutAction} settingsHref={settingsHref} compact />
        </header>

        {/* Mobile menu page (the Menu tab's destination) */}
        {open && <MobileMenuPage sections={sections} sidebarExtra={sidebarExtra} onClose={() => setOpen(false)} />}

        <main className="mx-auto w-full max-w-[96rem] flex-1 overflow-x-clip px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 md:pb-8">
          {children}
        </main>

        <MobileTabBar sections={sections} menuOpen={open} onMenu={() => setOpen((v) => !v)} />
      </div>
    </div>
  );
}
