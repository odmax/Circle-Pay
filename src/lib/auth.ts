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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.phone = user.phone ?? null
        token.currency = user.currency
        // Check admin status during login
        prisma.internalAdmin.findUnique({ where: { userId: user.id }, select: { isActive: true, role: true } }).then((a) => {
          token.isAdmin = !!(a?.isActive)
          token.adminRole = a?.role as string || undefined
        }).catch(() => {})
        prisma.user.findUnique({ where: { id: user.id }, select: { email: true } }).then((u) => {
          token.isPrimaryOwner = !!(process.env.OWNER_EMAIL && u?.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase())
        }).catch(() => {})
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
          token.isPrimaryOwner = !!(process.env.OWNER_EMAIL && dbUser.email?.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase())
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
