import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Owner forms upload photos (client-compressed, but PDFs pass through).
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
