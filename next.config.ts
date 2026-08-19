import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Legacy platform-specific routes → unified /w/[provider]/[id]
    return [
      {
        source: "/scenarios/:id",
        destination: "/w/make/:id",
        permanent: false,
      },
      {
        source: "/workflows/ghl/:id",
        destination: "/w/ghl/:id",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
