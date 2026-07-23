// DK CMS color system — mirrors apps/web/src/app/globals.css exactly.
export const colors = {
  background: "#05070d",
  surface: "#0d1220",
  surfaceRaised: "#131a2c",
  border: "#1f2940",
  foreground: "#e7ecf7",
  muted: "#8592ad",
  accent: "#37f0c2",
  accentSoft: "rgba(55, 240, 194, 0.12)",
  accentStrong: "#1fe7b3",
  danger: "#ff5470",
  warning: "#f5c542",
  success: "#22c55e",
};

export const radius = { card: 16, control: 10, pill: 999 };

/** Inter (loaded in the root layout) — referenced by styles instead of bare fontWeight. */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
};

/** Per-module accent palettes, same idea as the web dashboard PALETTES. */
export const palettes = {
  mint: { from: "#37f0c2", to: "#1fe7b3" },
  violet: { from: "#a78bfa", to: "#7c3aed" },
  blue: { from: "#60a5fa", to: "#2563eb" },
  pink: { from: "#f472b6", to: "#db2777" },
  amber: { from: "#fbbf24", to: "#d97706" },
};
