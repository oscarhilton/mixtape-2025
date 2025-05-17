import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/shared-ui', '@repo/shared-contexts'],
  /* config options here */
};

export default nextConfig;
