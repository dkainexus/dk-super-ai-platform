import "server-only";
// Server-side glue: builds AppShell props for the current user (platform or
// merchant), pulling brand from settings/merchant and nav from the module
// registry. Both /admin and /m layouts use this.

import { AppShell } from "@/components/app-shell";
import { AiWidget } from "@/modules/ai/components/ai-chat";
import { logoutAction } from "@/app/actions/auth";
import { navSectionsFor } from "@/lib/nav";
import { platformSettings, globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { can, type CurrentUser } from "@/lib/auth";
import { aiSettings, activeKey } from "@/modules/ai/lib";
import { activeCountry } from "@/modules/merchants/lib";
import { CountrySwitcher } from "@/modules/merchants/components/country-switcher";

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

  // Active-country switcher (merchant portal, multi-country white labels).
  const countryCtx = cu.merchant ? await activeCountry(cu) : null;

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
      headerExtra={
        countryCtx && countryCtx.allowed.length > 1 && countryCtx.active ? (
          <CountrySwitcher
            countries={countryCtx.allowed.map((c) => ({ id: c.id, name: c.name, flag: c.flag }))}
            activeId={countryCtx.active.id}
          />
        ) : undefined
      }
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
