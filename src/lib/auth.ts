import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"
import { prisma } from "./prisma"
import { loginSchema } from "./validations/auth"
import { seedPlans, assignFreePlan } from "./services/subscription.service"

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
      if (process.env.OWNER_EMAIL && user.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase()) {
        try {
          await prisma.internalAdmin.upsert({
            where: { userId: user.id },
            create: { userId: user.id, role: "SUPER_ADMIN" },
            update: {},
          })
        } catch {}
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.phone = user.phone ?? null
        token.currency = user.currency
        // Check admin status during login
        prisma.internalAdmin.findUnique({ where: { userId: user.id }, select: { isActive: true } }).then((a) => {
          token.isAdmin = !!(a?.isActive)
        }).catch(() => {})
      }
      if (trigger === "update" && token.id) {
        return prisma.user.findUnique({
          where: { id: token.id as string },
          select: { phone: true, currency: true, name: true },
        }).then((dbUser) => {
          if (dbUser) {
            token.phone = dbUser.phone
            token.currency = dbUser.currency
            token.name = dbUser.name
          }
          return token
        })
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.phone = token.phone as string | null
        session.user.currency = token.currency as string
        (session.user as any).isAdmin = token.isAdmin as boolean || false
      }
      return session
    },
  },
})
