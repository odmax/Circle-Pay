import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const protectedPaths = [
        "/dashboard",
        "/circles",
        "/settings",
      ]
      const isProtected = protectedPaths.some((path) =>
        nextUrl.pathname.startsWith(path)
      )
      if (isProtected) {
        if (isLoggedIn) return true
        return Response.redirect(new URL("/login", nextUrl))
      }
      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
