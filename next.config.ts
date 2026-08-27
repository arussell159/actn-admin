import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
    ],
  },
}

export default nextConfig
