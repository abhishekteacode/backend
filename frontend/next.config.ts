import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: "http://127.0.0.1:3000/:path*",
      },
    ];
  },
};

export default nextConfig;
