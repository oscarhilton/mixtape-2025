import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/shared-ui", "@repo/shared-contexts"],
  images: {
    remotePatterns: [new URL('https://i.scdn.co/image/*')],
  },
  /* config options here */
};

export default nextConfig;
