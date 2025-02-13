import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/hypercms',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure assets are served from the correct path
  assetPrefix: '/hypercms',
};

export default nextConfig;
