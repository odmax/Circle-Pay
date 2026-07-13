import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      phone?: string | null
      currency?: string
      isAdmin?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    phone?: string | null
    currency?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    phone?: string | null
    currency?: string
    isAdmin?: boolean
    adminRole?: string
    isPrimaryOwner?: boolean
  }
}
