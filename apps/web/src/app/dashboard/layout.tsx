import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <nav className="flex gap-5 text-sm">
          <Link href="/admin" className="text-[var(--fg-muted)]">← CMS</Link>
          <Link href="/dashboard/documents">证件审核</Link>
          <Link href="/dashboard/jobs">任务监控</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm text-[var(--fg-muted)]">
          <span>
            {user.name || user.username} · {user.role}
          </span>
          <form action={logoutAction}>
            <button type="submit">退出</button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
