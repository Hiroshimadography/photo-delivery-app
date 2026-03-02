import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore - Valid Next.js option, type definition may be outdated
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
