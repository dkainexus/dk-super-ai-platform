import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { platformSettings, getSetting } from "@/lib/settings";
import {
  savePlatformSettings,
  saveTrackingKey,
  uploadPlatformLogo,
  removePlatformLogo,
  uploadPlatformFavicon,
  removePlatformFavicon,
} from "@/app/actions/settings";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";
import { BrandImageEditor } from "@/components/brand-image-editor";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePerm("settings", "view");
  const { error } = await searchParams;
  const platform = await platformSettings();
  const [platformLogoUrl, platformFaviconUrl] = await Promise.all([
    signedUrl(ASSETS_BUCKET, platform.logo_path ?? null),
    signedUrl(ASSETS_BUCKET, platform.favicon_path ?? null),
  ]);
  const shipping = await getSetting<{ trackingmore_key?: string }>("shipping", {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Platform-wide configuration. Everything here applies globally.</p>
      </div>
      <ErrorBanner message={error} />

      {/* General */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">General</h2>
        <p className="mb-4 text-xs text-muted">Basic platform identity — click the logo to change it.</p>
        <div className="mb-5 flex flex-wrap items-end gap-6">
          <div>
            <p className="mb-1.5 text-xs text-muted">Logo (horizontal — sits above the name in the sidebar)</p>
            <BrandImageEditor
              imageUrl={platformLogoUrl}
              initial={platform.name.slice(0, 1).toUpperCase()}
              shape="wide"
              fieldName="logo"
              title="logo"
              uploadAction={uploadPlatformLogo}
              removeAction={removePlatformLogo}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted">Favicon (square — the browser tab icon)</p>
            <BrandImageEditor
              imageUrl={platformFaviconUrl}
              initial={platform.name.slice(0, 1).toUpperCase()}
              shape="square"
              fieldName="favicon"
              title="favicon"
              uploadAction={uploadPlatformFavicon}
              removeAction={removePlatformFavicon}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-5">
          <form action={savePlatformSettings} className="flex max-w-md flex-1 items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted">Platform Name (shown in the sidebar & login page)</label>
              <input name="name" defaultValue={platform.name} className="input" required />
            </div>
            <SaveButton tip="Save general settings" />
          </form>
        </div>
      </section>

      {/* Shipping tracking */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Shipping Tracking</h2>
        <p className="mb-4 text-xs text-muted">
          TrackingMore API key — with it, customers see live courier events inside the portal instead of a
          bare tracking number. Register at trackingmore.com and paste the key here.
        </p>
        <form action={saveTrackingKey} className="flex max-w-md items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">TrackingMore API key</label>
            <input
              name="trackingmore_key"
              defaultValue={shipping.trackingmore_key ? "••••••••" + shipping.trackingmore_key.slice(-4) : ""}
              placeholder="not set — portal shows our own milestones only"
              className="input mono-num"
            />
          </div>
          <SaveButton tip="Save the tracking token (leave the masked value to keep it)" />
        </form>
      </section>

      {/* Mobile app */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Mobile App</h2>
        <p className="mb-3 text-xs text-muted">APK releases and in-app updates.</p>
        <Link href="/admin/settings/app" className="inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">
          App Releases — upload & publish →
        </Link>
      </section>

      {/* Bot tools */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Bot Tools</h2>
        <p className="mb-3 text-xs text-muted">Telegram bot operations (legacy group flow).</p>
        <div className="flex gap-3">
          <Link href="/dashboard/documents" className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">
            Document Review
          </Link>
          <Link href="/dashboard/jobs" className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">
            Bot Jobs
          </Link>
        </div>
      </section>
    </div>
  );
}
