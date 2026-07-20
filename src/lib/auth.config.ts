import type { NextAuthConfig } from "next-auth"
import { isPrimaryOwnerEmail } from "./owner-email"

const protectedRoutePrefixes = [
  "/dashboard",
  "/circles",
  "/settings",
  "/notifications",
  "/discover",
  "/support",
  "/upgrade",
  "/portfolio",
  "/receipts",
  "/owner",
]

const ownerRoutePrefix = "/owner"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = nextUrl

      // Check if route is protected
      const isProtected = protectedRoutePrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
      )

      if (!isProtected) return true

      // Unauthenticated → redirect to login
      if (!isLoggedIn) {
        const loginUrl = new URL("/login", nextUrl)
        loginUrl.searchParams.set("callbackUrl", pathname)
        return Response.redirect(loginUrl)
      }

      // Owner routes require admin or primary owner status
      const isOwnerRoute =
        pathname === ownerRoutePrefix || pathname.startsWith(ownerRoutePrefix + "/")
      if (isOwnerRoute) {
        const user = auth.user as any
        const isAdmin = !!user?.isAdmin
        const isPrimaryOwner = isPrimaryOwnerEmail(user?.email)
        if (!isAdmin && !isPrimaryOwner) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
      }

      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
