import { createHash } from "node:crypto"
import type { NextConfig } from "next"

const deploymentVersion =
  process.env.DEPLOYMENT_VERSION ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA

// Next.js limits deploymentId to 32 characters; commit SHAs have 40.
// Hash the full value so long release names with a shared prefix stay distinct.
const deploymentId =
  deploymentVersion && deploymentVersion.length > 32
    ? createHash("sha256").update(deploymentVersion).digest("hex").slice(0, 32)
    : deploymentVersion

const applicationDocumentRoutes = [
  "/",
  "/dashboard",
  "/information",
  "/login",
  "/month-end/:path*",
  "/previous-month-ends/:path*",
  "/pricing-upload",
  "/quote-tool",
  "/template-builder",
]

const nextConfig: NextConfig = {
  deploymentId,
  async headers() {
    return [
      ...applicationDocumentRoutes.map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      })),
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ]
  },
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
