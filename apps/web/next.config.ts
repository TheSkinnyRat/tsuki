import type { NextConfig } from "next";

const config: NextConfig = {
  // The shared packages are published as TypeScript source, not built output.
  transpilePackages: ["@tsuki/shared", "@tsuki/db"],
  experimental: { typedRoutes: false },
};

export default config;
