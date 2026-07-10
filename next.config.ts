import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Increase serverless function timeout for ITN webhooks
  serverExternalPackages: ["@prisma/adapter-pg"],
}

export default nextConfig
