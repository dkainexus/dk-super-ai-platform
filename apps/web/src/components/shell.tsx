import "server-only";
// Server-side glue: builds AppShell props for the current user (platform or
// merchant), pulling brand from settings/merchant and nav from the module
// registry. Both /admin and /m layouts use this.

import { AppShell } from "@/components/app-shell";
import { AiWidget } from "@/components/ai-chat";
import { logoutAction } from "@/app/actions/auth";
import { navSectionsFor } from "@/lib/nav";
import { platformSettings, globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { can, type CurrentUser } from "@/lib/auth";
import { aiSettings, activeKey } from "@/lib/ai";

export async function Shell({ cu, children }: { cu: CurrentUser; children: React.ReactNode }) {
  const [sections, platform, avatarUrl, toggles] = await Promise.all([
    navSectionsFor(cu),
    platformSettings(),
    signedUrl(ASSETS_BUCKET, cu.user.avatar_path, 60 * 60 * 12),
    globalModuleToggles(),
  ]);

  // Floating AI Assistant — for users whose role can view the AI module.
  const aiOn = Boolean(can(cu, "ai", "view")) && moduleEnabledFor("ai", toggles, cu.merchant);
  const ai = aiOn ? await aiSettings() : null;

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
      {ai && (
        <AiWidget
          configured={Boolean(activeKey(ai))}
          greeting={`Hi ${cu.user.name || cu.user.username}! Ask me anything about the data you have access to.`}
          fullPageHref={cu.merchant ? "/m/ai" : "/admin/ai"}
        />
      )}
    </AppShell>
  );
}
