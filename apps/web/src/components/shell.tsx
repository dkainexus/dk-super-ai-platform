import "server-only";
// Server-side glue: builds AppShell props for the current user (platform or
// merchant), pulling brand from settings/merchant and nav from the module
// registry. Both /admin and /m layouts use this.

import { AppShell } from "@/components/app-shell";
import { logoutAction } from "@/app/actions/auth";
import { navSectionsFor } from "@/lib/nav";
import { platformSettings } from "@/lib/settings";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import type { CurrentUser } from "@/lib/auth";

export async function Shell({ cu, children }: { cu: CurrentUser; children: React.ReactNode }) {
  const [sections, platform, avatarUrl] = await Promise.all([
    navSectionsFor(cu),
    platformSettings(),
    signedUrl(ASSETS_BUCKET, cu.user.avatar_path, 60 * 60 * 12),
  ]);

  const merchantLogo = cu.merchant
    ? await signedUrl(ASSETS_BUCKET, cu.merchant.logo_path, 60 * 60 * 12)
    : null;

  return (
    <AppShell
      brand={{
        name: cu.merchant ? cu.merchant.name : platform.name,
        logoUrl: merchantLogo,
        homeHref: cu.merchant ? "/m" : "/admin",
      }}
      sections={sections}
      user={{
        label: cu.user.name || cu.user.username,
        sub: cu.isSuper ? "Superadmin" : cu.role?.name ?? null,
        avatarUrl,
      }}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
