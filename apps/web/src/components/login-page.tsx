/* eslint-disable @next/next/no-img-element */
import { tenantFromHost } from "@/lib/tenant";
import { platformSettings } from "@/lib/settings";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { LoginForm } from "@/components/LoginForm";

/**
 * One look, three doors. The audience decides which kind of account the
 * form accepts; the brand comes from the tenant when there is one.
 */
export async function LoginPageView({
  audience,
  subtitle,
}: {
  audience: "admin" | "merchant" | "portal";
  subtitle: string;
}) {
  const [tenant, platform] = await Promise.all([tenantFromHost(), platformSettings()]);
  // On a white label's domain the door wears their brand; ours otherwise.
  const brand = tenant;
  const logoUrl = await signedUrl(ASSETS_BUCKET, brand ? brand.logo_path : platform.logo_path ?? null);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-2 flex items-center justify-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-white/10" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          )}
          <h1 className="text-2xl font-semibold tracking-[0.08em]">{brand?.name ?? platform.name}</h1>
        </div>
        <p className="mb-6 text-center text-sm text-muted">{subtitle}</p>
        <div className="card glow-border p-6">
          <LoginForm audience={audience} />
        </div>
      </div>
    </main>
  );
}
