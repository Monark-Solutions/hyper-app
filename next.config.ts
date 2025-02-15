import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure assets are served from the correct path
  assetPrefix: '',
};

export default nextConfig;
