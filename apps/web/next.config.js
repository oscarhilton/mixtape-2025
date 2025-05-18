/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/shared-ui", "@repo/shared-contexts"], // Ensure your shared packages are transpiled
  output: 'standalone', // Enable standalone output for Docker
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        pathname: '/image/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Ensure this destination matches where your Express API (packages/api) is running
        destination: `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig; 