import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Owner forms upload photos (client-compressed, but PDFs pass through).
      bodySizeLimit: "20mb",
    },
    // App-like navigation: pages just visited stay in the client router cache
    // for 30s, so back/forward and quick revisits render instantly (the 30s
    // auto-refresh heartbeat keeps the data honest).
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
