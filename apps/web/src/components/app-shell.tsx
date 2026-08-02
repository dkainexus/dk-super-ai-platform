"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element -- logos/avatars come from signed Supabase URLs */
import { SidebarNav, type NavSection } from "@/components/sidebar-nav";

export type ShellBrand = {
  name: string;
  logoUrl?: string | null;
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
}: {
  user: ShellUser;
  logoutAction: () => Promise<void>;
  settingsHref?: string;
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
        className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:border-accent"
      >
        <Avatar user={user} />
        <span className="max-w-32 truncate text-sm">{user.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
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
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Brand brand={brand} />
          <div className="flex items-center gap-2">
            {headerExtra}
            <UserMenu user={user} logoutAction={logoutAction} settingsHref={settingsHref} />
            <button aria-label="Menu" onClick={() => setOpen(true)} className="rounded-md border border-border p-2 text-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 flex h-dvh w-72 max-w-[85%] flex-col border-r border-border bg-surface px-3 py-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <div className="mb-4 flex items-center justify-between">
                <Brand brand={brand} onClick={() => setOpen(false)} />
                <button aria-label="Close" onClick={() => setOpen(false)} className="rounded-md border border-border p-1.5 text-muted">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {sidebarExtra && <div className="mb-4">{sidebarExtra}</div>}
              <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
                <SidebarNav sections={sections} />
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[96rem] flex-1 overflow-x-clip px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
