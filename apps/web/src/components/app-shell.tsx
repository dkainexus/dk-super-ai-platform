"use client";

import { useState } from "react";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element -- logos come from signed Supabase URLs */
import { SidebarNav, type NavSection } from "@/components/sidebar-nav";

export type ShellBrand = {
  name: string;
  logoUrl?: string | null;
  homeHref: string;
};

function Brand({ brand, onClick }: { brand: ShellBrand; onClick?: () => void }) {
  return (
    <Link
      href={brand.homeHref}
      onClick={onClick}
      className="flex items-center gap-2 px-3 font-semibold tracking-tight"
    >
      {brand.logoUrl ? (
        <img
          src={brand.logoUrl}
          alt=""
          className="h-6 w-6 rounded-md object-cover"
        />
      ) : (
        <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
      )}
      <span className="truncate text-foreground">{brand.name}</span>
    </Link>
  );
}

export function AppShell({
  brand,
  sections,
  userLabel,
  logoutAction,
  children,
}: {
  brand: ShellBrand;
  sections: NavSection[];
  userLabel: string;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const logoutForm = (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
      >
        退出登录
      </button>
    </form>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-5 md:flex">
        <div className="mb-6">
          <Brand brand={brand} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav sections={sections} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-20 hidden items-center justify-end gap-3 border-b border-border bg-surface/70 px-6 py-3 backdrop-blur md:flex">
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
            </svg>
            {userLabel}
          </span>
          <span className="h-5 w-px bg-border" />
          {logoutForm}
        </header>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          <Brand brand={brand} />
          <button
            aria-label="Menu"
            onClick={() => setOpen(true)}
            className="rounded-md border border-border p-2 text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </header>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 flex h-dvh w-72 max-w-[85%] flex-col border-r border-border bg-surface px-3 py-5">
              <div className="mb-6 flex items-center justify-between">
                <Brand brand={brand} onClick={() => setOpen(false)} />
                <button
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border p-1.5 text-muted"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
                <SidebarNav sections={sections} />
              </div>
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <p className="px-1 text-sm text-muted">{userLabel}</p>
                {logoutForm}
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
