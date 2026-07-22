import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { AppShell } from "@/components/app-shell";
import { adminNavSections } from "@/modules/registry";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireAdmin();

  return (
    <AppShell
      brand={{ name: "DK CMS", homeHref: "/admin" }}
      sections={adminNavSections()}
      userLabel={`${staff.name || staff.username} · ${staff.role}`}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
