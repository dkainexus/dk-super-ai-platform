import { NextResponse } from "next/server";
import { tenantFromHost } from "@/lib/tenant";
import { platformSettings } from "@/lib/settings";

// The install manifest, brand-aware: on a white label's domain the app
// installs under their name. Icons stay the platform set for now.
export async function GET() {
  const [tenant, platform] = await Promise.all([tenantFromHost(), platformSettings()]);
  const name = tenant?.name ?? platform.name;

  return NextResponse.json(
    {
      name,
      short_name: name.length > 12 ? name.slice(0, 12) : name,
      description: `${name} console`,
      start_url: "/login",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0e0f13",
      theme_color: "#0e0f13",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } }
  );
}
