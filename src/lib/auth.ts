import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { authConfig } from "./auth.config"
import { prisma } from "./prisma"
import { loginSchema } from "./validations/auth"
import { seedPlans, assignFreePlan, assignOwnerUnlimitedPlan } from "./services/subscription.service"
import { isPrimaryOwnerEmail } from "./owner-email"

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    console.error("CRITICAL: AUTH_SECRET is missing or shorter than 32 characters. Set a strong secret in production.")
  } else {
    process.env.AUTH_SECRET = crypto.randomBytes(32).toString("base64")
    console.warn("AUTH_SECRET was missing or too short. Generated a temporary dev secret.")
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          phone: user.phone,
          currency: user.currency,
        }
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      if (!user.id) return
      await seedPlans()
      await assignFreePlan(user.id)
      if (isPrimaryOwnerEmail(user.email)) {
        try {
          await prisma.internalAdmin.upsert({
            where: { userId: user.id },
            create: { userId: user.id, role: "SUPER_ADMIN" },
            update: {},
          })
          await assignOwnerUnlimitedPlan(user.id)
        } catch {}
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.phone = user.phone ?? null
        token.currency = user.currency
        const [dbAdmin, dbOwner] = await Promise.all([
          prisma.internalAdmin.findUnique({ where: { userId: user.id }, select: { isActive: true, role: true } }).catch(() => null),
          prisma.user.findUnique({ where: { id: user.id }, select: { email: true } }).catch(() => null),
        ])
        token.isAdmin = !!(dbAdmin?.isActive)
        token.adminRole = dbAdmin?.role as string || undefined
        token.isPrimaryOwner = isPrimaryOwnerEmail(dbOwner?.email)
      }
      if (trigger === "update" && token.id) {
        const uid = token.id as string
        const [dbUser, dbAdmin] = await Promise.all([
          prisma.user.findUnique({ where: { id: uid }, select: { phone: true, currency: true, name: true, email: true } }),
          prisma.internalAdmin.findUnique({ where: { userId: uid }, select: { isActive: true, role: true } }),
        ])
        if (dbUser) {
          token.phone = dbUser.phone
          token.currency = dbUser.currency
          token.name = dbUser.name
          token.isAdmin = !!(dbAdmin?.isActive)
          token.adminRole = dbAdmin?.role as string || undefined
          token.isPrimaryOwner = isPrimaryOwnerEmail(dbUser.email)
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        const su = session.user as any
        su.id = token.id as string
        su.phone = token.phone as string | null
        su.currency = token.currency as string
        su.isAdmin = token.isAdmin || false
        su.isPrimaryOwner = (token as any).isPrimaryOwner || false
      }
      return session
    },
  },
})
