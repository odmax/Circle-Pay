import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

async function requireOwnerAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const admin = await prisma.internalAdmin.findUnique({
    where: { userId: session.user.id },
  })
  if (!admin || !admin.isActive) throw new Error("Forbidden")
  return session.user.id
}

export async function getOwnerDashboard() {
  try {
  await requireOwnerAdmin()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const safeNum = (v: any) => Number(v?._sum?.amount ?? 0)

  // Critical queries
  const critical = await Promise.all([
    prisma.user.count(),
    prisma.circle.count({ where: { isActive: true } }),
    prisma.userSubscription.count({ where: { status: "ACTIVE" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, createdAt: true } }),
  ]).catch(() => [0, 0, 0, []])

  const [totalUsers, totalCircles, activeUsers, recentUsers] = critical as [number, number, number, any[]]

  // Optional queries — failure in one does not crash the dashboard
  const [premiumResult, communityResult, revenueResult, mrrResult, todayRevenueResult, todayPaymentsResult,
    recentPaymentsResult, recentCirclesResult, pendingVerifResult, pendingJoinResult, verifiedResult, publicResult, walletResult, activeCirclesResult] =
    await Promise.allSettled([
      prisma.userSubscription.count({ where: { status: "ACTIVE", plan: { slug: "premium" } } }),
      prisma.userSubscription.count({ where: { status: "ACTIVE", plan: { slug: "community" } } }),
      prisma.paymentTransaction.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      prisma.paymentTransaction.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.paymentTransaction.aggregate({ where: { status: "PAID", paidAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.paymentTransaction.count({ where: { status: "PAID", paidAt: { gte: todayStart } } }),
      prisma.paymentTransaction.findMany({ where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 8, include: { user: { select: { id: true, name: true, email: true } }, plan: { select: { name: true } } } }),
      prisma.circle.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 8, include: { createdBy: { select: { id: true, name: true } }, _count: { select: { members: true } } } }),
      prisma.circleVerification.count({ where: { status: "PENDING" } }),
      prisma.joinRequest.count({ where: { status: "PENDING" } }),
      prisma.circleVerification.count({ where: { status: "VERIFIED" } }),
      prisma.circle.count({ where: { visibility: "PUBLIC", isActive: true } }),
      prisma.ledgerTransaction.aggregate({ where: { status: "CONFIRMED" } as any, _sum: { amount: true } }),
      prisma.circle.count({ where: { isActive: true } }),
    ])

  const val = (r: PromiseSettledResult<any>) => r.status === "fulfilled" ? r.value : 0
  const arr = <T>(r: PromiseSettledResult<T[]>) => r.status === "fulfilled" ? (r.value as T[]) : []

  const premiumUsers = val(premiumResult)
  const communityUsers = val(communityResult)
  const totalRevenue = safeNum(revenueResult.status === "fulfilled" ? revenueResult.value : {})
  const mrr = safeNum(mrrResult.status === "fulfilled" ? mrrResult.value : {})
  const todayRevenue = safeNum(todayRevenueResult.status === "fulfilled" ? todayRevenueResult.value : {})
  const todayPayments = val(todayPaymentsResult)
  const recentPayments = arr<any>(recentPaymentsResult)
  const recentCircles = arr<any>(recentCirclesResult)
  const pendingVerifications = val(pendingVerifResult)
  const pendingJoinRequests = val(pendingJoinResult)
  const verifiedCircles = val(verifiedResult)
  const publicCircles = val(publicResult)
  const totalWalletVolume = safeNum(walletResult.status === "fulfilled" ? walletResult.value : {})
  const activeCircles = val(activeCirclesResult)

  // Build activity feed
  const activityFeed: { type: string; title: string; detail: string; time: Date; link: string }[] = []
  for (const u of recentUsers.slice(0, 4)) {
    activityFeed.push({ type: "user", title: `${u.name || u.email} registered`, detail: "New user", time: u.createdAt.toISOString(), link: `/owner/users/${u.id}` })
  }
  for (const p of recentPayments.slice(0, 4)) {
    activityFeed.push({ type: "payment", title: `${p.user?.name || p.user?.email || "User"} paid`, detail: `R${Number(p.amount).toLocaleString()} — ${p.plan?.name || "Plan"}`, time: (p.paidAt || p.createdAt).toISOString(), link: `/owner/payments/${p.id}` })
  }
  for (const c of recentCircles.slice(0, 3)) {
    activityFeed.push({ type: "circle", title: `${c.name} created`, detail: `${c._count.members} member${c._count.members !== 1 ? "s" : ""}`, time: c.createdAt.toISOString(), link: `/owner/circles/${c.id}` })
  }
  activityFeed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return {
    totalUsers, totalCircles, activeUsers, activeCircles,
    premiumUsers, communityUsers,
    verifiedCircles, publicCircles,
    totalRevenue: Number.isNaN(totalRevenue) ? 0 : totalRevenue,
    mrr: Number.isNaN(mrr) ? 0 : mrr,
    todayRevenue: Number.isNaN(todayRevenue) ? 0 : todayRevenue,
    todayPayments,
    totalWalletVolume: Number.isNaN(totalWalletVolume) ? 0 : totalWalletVolume,
    pendingVerifications, pendingJoinRequests,
    recentUsers: recentUsers.map((u: any) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt.toISOString() })),
    recentPayments: recentPayments.map((p: any) => ({ id: p.id, amount: Number(p.amount), plan: { name: p.plan?.name || null }, user: { name: p.user?.name || null, email: p.user?.email || null }, paidAt: p.paidAt?.toISOString() || null, createdAt: p.createdAt.toISOString() })),
    activityFeed: activityFeed.slice(0, 12),
  }
  } catch (error) {
    console.error("OWNER PAGE ERROR", { page: "Dashboard", error, stack: error instanceof Error ? error.stack : undefined })
    throw error
  }
}

export async function getOwnerUsers() {
  try {
  await requireOwnerAdmin()
  const users = await prisma.user.findMany({
    include: {
      subscription: { include: { plan: { select: { name: true } } } },
      _count: { select: { circleMembers: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return users.map((u) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    plan: u.subscription?.plan?.name || "Free",
    circleCount: u._count.circleMembers,
    createdAt: u.createdAt.toISOString(),
  }))
  } catch (error) {
    console.error("OWNER PAGE ERROR", { page: "Users", error, stack: error instanceof Error ? error.stack : undefined })
    throw error
  }
}

export async function updateUserPlan(userId: string, planSlug: string) {
  await requireOwnerAdmin()
  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
  if (!plan) throw new Error("Plan not found")
  const now = new Date()
  return prisma.userSubscription.upsert({
    where: { userId },
    create: { userId, planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()) },
    update: { planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()) },
  })
}

export async function getOwnerCircles(filters?: {
  search?: string; type?: string; visibility?: string; verification?: string
  isActive?: string; page?: number; pageSize?: number; sort?: string
}) {
  try {
  await requireOwnerAdmin()
  const page = filters?.page || 1
  const pageSize = filters?.pageSize || 20
  const where: Record<string, unknown> = {}
  if (filters?.search) where.name = { contains: filters.search, mode: "insensitive" }
  if (filters?.type) where.type = filters.type
  if (filters?.visibility) where.visibility = filters.visibility
  if (filters?.verification) {
    if (filters.verification === "VERIFIED") where.verification = { status: "VERIFIED" }
    else if (filters.verification === "PENDING") where.verification = { status: "PENDING" }
    else if (filters.verification === "NONE") where.verification = null
  }
  if (filters?.isActive === "true") where.isActive = true
  else if (filters?.isActive === "false") where.isActive = false

  const orderBy: Record<string, string> = {}
  if (filters?.sort === "members") orderBy.members = { _count: "desc" } as any
  else if (filters?.sort === "name") orderBy.name = "asc"
  else orderBy.createdAt = "desc"

  const [circles, totalCount, summary] = await Promise.all([
    prisma.circle.findMany({
      where, orderBy: orderBy as any, skip: (page - 1) * pageSize, take: pageSize,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true } },
        verification: true,
        reputation: true,
      },
    }),
    prisma.circle.count({ where }),
    prisma.circle.aggregate({
      _count: true,
    }).then(async () => {
      const [active, publicC, verified, deactivated, totalMembers] = await Promise.all([
        prisma.circle.count({ where: { isActive: true } }),
        prisma.circle.count({ where: { visibility: "PUBLIC", isActive: true } }),
        prisma.circleVerification.count({ where: { status: "VERIFIED" } }),
        prisma.circle.count({ where: { isActive: false } }),
        prisma.circleMember.count(),
      ])
      return { active, public: publicC, verified, deactivated, totalMembers }
    }),
  ])

  return {
    items: circles.map((c) => ({
      id: c.id, name: c.name, type: c.type,
      owner: { name: c.createdBy?.name || null, email: c.createdBy?.email || null },
      memberCount: c._count.members,
      visibility: c.visibility, isActive: c.isActive,
      verification: c.verification?.status || "NONE",
      reputation: c.reputation?.score || 0,
      country: c.country, city: c.city,
      createdAt: c.createdAt.toISOString(),
    })),
    totalCount, page, pageSize,
    summary,
  }
  } catch (error) {
    console.error("OWNER PAGE ERROR", { page: "Circles", error, stack: error instanceof Error ? error.stack : undefined })
    throw error
  }
}

export async function getOwnerSubscriptions() {
  await requireOwnerAdmin()
  const subs = await prisma.userSubscription.findMany({
    include: { user: { select: { name: true, email: true } }, plan: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return subs.map((s) => ({
    id: s.id, status: s.status,
    user: { name: s.user?.name || null, email: s.user?.email || null },
    plan: { name: s.plan?.name || null, slug: s.plan?.slug || null },
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }))
}

export async function getOwnerPayments(status?: string) {
  await requireOwnerAdmin()
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  const payments = await prisma.paymentTransaction.findMany({
    where,
    include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return payments.map((p) => ({
    id: p.id, amount: Number(p.amount), currency: p.currency, status: p.status, merchantReference: p.merchantReference,
    user: { name: p.user?.name || null, email: p.user?.email || null },
    plan: { name: p.plan?.name || null },
    createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() || null,
  }))
}

export async function getOwnerRevenue(filters?: { startDate?: string; endDate?: string; planId?: string; provider?: string; status?: string }) {
  await requireOwnerAdmin()
  const where: Record<string, unknown> = {}
  if (filters?.startDate || filters?.endDate) {
    where.paidAt = {}
    if (filters?.startDate) (where.paidAt as Record<string, unknown>).gte = new Date(filters.startDate)
    if (filters?.endDate) (where.paidAt as Record<string, unknown>).lte = new Date(filters.endDate)
  }
  if (filters?.planId) where.planId = filters.planId
  if (filters?.provider) where.provider = filters.provider
  where.status = filters?.status || "PAID"

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const [total, mrrPayments, arrPayments, byPlan, successCount, failCount, dailyRev] = await Promise.all([
    prisma.paymentTransaction.aggregate({ where: { ...where, status: "PAID" }, _sum: { amount: true } }),
    prisma.paymentTransaction.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.paymentTransaction.aggregate({ where: { status: "PAID", paidAt: { gte: yearStart } }, _sum: { amount: true } }),
    prisma.paymentTransaction.groupBy({ by: ["planId"], where: { ...where, status: "PAID" }, _sum: { amount: true }, _count: true }),
    prisma.paymentTransaction.count({ where: { status: "PAID" } }),
    prisma.paymentTransaction.count({ where: { status: "FAILED" } }),
    prisma.paymentTransaction.findMany({ where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 30, select: { amount: true, paidAt: true, planId: true } }),
  ])

  const plans = await prisma.plan.findMany({ select: { id: true, name: true } })
  const totalCount = successCount + failCount
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0

  return {
    totalRevenue: Number(total._sum.amount ?? 0),
    mrr: Number(mrrPayments._sum.amount ?? 0),
    arr: Number(arrPayments._sum.amount ?? 0),
    successCount, failCount, successRate,
    byPlan: byPlan.map((b) => ({
      plan: plans.find((p) => p.id === b.planId)?.name || "?",
      revenue: Number(b._sum.amount ?? 0),
      count: b._count,
    })),
    dailyRevenue: dailyRev.map((d) => ({ amount: Number(d.amount), date: d.paidAt?.toISOString().split("T")[0], planId: d.planId })),
  }
}

export async function getOwnerHealth() {
  await requireOwnerAdmin()
  const [users, circles, payments, notifications] = await Promise.all([
    prisma.user.count(), prisma.circle.count(), prisma.paymentTransaction.count(), prisma.notification.count(),
  ])
  return {
    database: "connected",
    payFastConfigured: !!(process.env.PAYFAST_MERCHANT_ID),
    appUrlConfigured: !!(process.env.NEXT_PUBLIC_APP_URL),
    authSecretConfigured: !!(process.env.AUTH_SECRET),
    counts: { users, circles, payments, notifications },
  }
}
