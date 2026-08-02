import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  // The tab icon follows the brand: a white label's favicon on its domain,
  // the platform's otherwise, the static tile as the last resort.
  const [{ tenantFromHost }, { platformSettings }, { signedUrl, ASSETS_BUCKET }] = await Promise.all([
    import("@/lib/tenant"),
    import("@/lib/settings"),
    import("@/lib/storage"),
  ]);
  const [tenant, platform] = await Promise.all([tenantFromHost(), platformSettings()]);
  const iconPath = tenant?.favicon_path ?? platform.favicon_path ?? null;
  const iconUrl = iconPath ? await signedUrl(ASSETS_BUCKET, iconPath, 60 * 60) : null;
  return {
    title: tenant?.name ?? platform.name,
    description: `${platform.name} — merchant & owner management`,
    icons: iconUrl ? { icon: iconUrl } : undefined,
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
