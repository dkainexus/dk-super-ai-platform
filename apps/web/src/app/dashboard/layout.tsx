import Link from "next/link";
import { requireBotStaff } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireBotStaff();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <nav className="flex gap-5 text-sm">
          <Link href="/admin/settings" className="text-[var(--fg-muted)]">← Back to CMS</Link>
          <Link href="/dashboard/documents">Document Review</Link>
          <Link href="/dashboard/jobs">Bot Jobs</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm text-[var(--fg-muted)]">
          <span>
            {user.name || user.username}
          </span>
          <form action={logoutAction}>
            <button type="submit">Sign Out</button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
