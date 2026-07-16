import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function getRateLimit(key: string, windowMs: number, maxRequests: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}

const AUTH_WINDOW_MS = 60 * 1000
const AUTH_MAX = 10
const MOBILE_AUTH_MAX = 5
const API_WINDOW_MS = 60 * 1000
const API_MAX = 100
const JOIN_MAX = 5

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"
}

function rateLimitResponse(retryAfter: number): NextResponse {
  return new NextResponse(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.ceil(retryAfter / 1000)),
    },
  })
}

function handleRateLimiting(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith("/api/")) return null

  const ip = getClientIp(request)

  if (pathname.startsWith("/api/cron/")) return null

  const isAuthEndpoint = (
    pathname === "/api/auth/callback/credentials"
    || pathname === "/api/auth/callback/google"
    || pathname === "/api/auth/signin"
    || pathname === "/api/auth/signout"
    || pathname === "/api/mobile/auth"
  )

  const isJoinEndpoint = (
    /^\/api\/invites\/[^/]+\/join$/.test(pathname)
    || /^\/api\/mobile\/join\//.test(pathname)
  )

  if (isAuthEndpoint) {
    const limit = pathname === "/api/mobile/auth" ? MOBILE_AUTH_MAX : AUTH_MAX
    const result = getRateLimit(`auth:${ip}`, AUTH_WINDOW_MS, limit)
    if (!result.allowed) return rateLimitResponse(result.resetAt - Date.now())
    return null
  }

  if (isJoinEndpoint) {
    const result = getRateLimit(`join:${ip}`, AUTH_WINDOW_MS, JOIN_MAX)
    if (!result.allowed) return rateLimitResponse(result.resetAt - Date.now())
    return null
  }

  const result = getRateLimit(`api:${ip}`, API_WINDOW_MS, API_MAX)
  if (!result.allowed) return rateLimitResponse(result.resetAt - Date.now())
  return null
}

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const rateLimited = handleRateLimiting(req.nextUrl ? req as unknown as NextRequest : req as unknown as NextRequest)
  if (rateLimited) return rateLimited
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
