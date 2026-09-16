import type { NextConfig } from "next";

const config: NextConfig = {
  // The shared packages are published as TypeScript source, not built output.
  transpilePackages: ["@tsuki/shared", "@tsuki/db"],
  experimental: { typedRoutes: false },
  // The floating dev badge sits on top of the player bar's artwork.
  devIndicators: false,
};

export default config;
