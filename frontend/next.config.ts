import type { NextConfig } from "next";
import { getStaticSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: Object.entries(getStaticSecurityHeaders()).map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default nextConfig;
