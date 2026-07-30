import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { customerForUser } from "@/modules/customers/lib";
import { AppShell } from "@/components/app-shell";
import { logoutAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Customer Portal" };

// The customer's own view: their accounts, their contracts, their invoices —
// and nothing else. Anyone signed in without a customer record is sent home.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const cu = await getCurrentUser();
  if (!cu) redirect("/login");
  const c = await customerForUser(cu.user.id);
  if (!c) redirect(cu.merchant ? "/m" : "/admin");
  if (c.status !== "active") redirect("/login");

  return (
    <AppShell
      brand={{ name: cu.merchant?.name ?? "Customer Portal", homeHref: "/portal" }}
      sections={[
        {
          items: [
            { href: "/portal", label: "My Accounts" },
            { href: "/portal/contracts", label: "My Contracts" },
            { href: "/portal/turnover", label: "Monthly Turnover" },
            { href: "/portal/invoices", label: "Invoices" },
            { href: "/portal/support", label: "Support" },
          ],
        },
      ]}
      user={{ label: cu.user.name || cu.user.username, sub: "Customer" }}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
