import { requireMerchant } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { AppShell } from "@/components/app-shell";
import { merchantNavSections } from "@/modules/registry";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const { user, merchant } = await requireMerchant();
  const logoUrl = await signedUrl(ASSETS_BUCKET, merchant.logo_path, 60 * 60 * 12);

  return (
    <AppShell
      brand={{ name: merchant.name, logoUrl, homeHref: "/m" }}
      sections={merchantNavSections()}
      userLabel={user.name || user.username}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
