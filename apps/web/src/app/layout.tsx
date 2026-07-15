import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DK Super AI",
  description: "DK Super AI — operations dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
