import type { NextConfig } from "next";

const pluginFrameOrigins = (process.env.NEXT_PUBLIC_SOROTASK_PLUGIN_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => {
    const url = new URL(origin);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        `Invalid plugin origin "${origin}". Plugin origins must be HTTPS origins without a path.`,
      );
    }

    return url.origin;
  });

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-src 'self' ${pluginFrameOrigins.join(" ")};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
