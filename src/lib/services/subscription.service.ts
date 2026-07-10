import { prisma } from "@/lib/prisma"

const DEFAULT_PLANS = [
  {
    name: "Free",
    slug: "free",
    description: "For individuals getting started with group finance",
    price: 0,
    currency: "ZAR",
    interval: "MONTHLY" as const,
    circleLimit: 3,
    sortOrder: 0,
    features: [
      "Up to 3 circles",
      "Basic expense tracking",
      "Basic contributions",
      "Basic savings goals",
      "In-app notifications",
      "Mobile app access",
    ],
  },
  {
    name: "Premium",
    slug: "premium",
    description: "For power users who want unlimited everything",
    price: 49,
    currency: "ZAR",
    interval: "MONTHLY" as const,
    circleLimit: 999,
    sortOrder: 1,
    features: [
      "Unlimited circles",
      "Advanced contribution tracking",
      "Advanced goal analytics",
      "Detailed reports",
      "AI features (coming soon)",
      "Priority support",
      "Export data",
    ],
  },
  {
    name: "Community",
    slug: "community",
    description: "For stokvels, churches, and community organizations",
    price: 99,
    currency: "ZAR",
    interval: "MONTHLY" as const,
    circleLimit: 999,
    sortOrder: 2,
    features: [
      "Unlimited circles",
      "Stokvel management tools",
      "Church finance management",
      "Burial society tools",
      "Community finance tools",
      "Group voting (coming soon)",
      "Payout tracking (coming soon)",
      "Loan management (coming soon)",
      "Priority support",
    ],
  },
]

export async function seedPlans() {
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        circleLimit: plan.circleLimit,
        features: plan.features,
        sortOrder: plan.sortOrder,
      },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        circleLimit: plan.circleLimit,
        features: plan.features,
        sortOrder: plan.sortOrder,
      },
    })
  }
}

export async function getPlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })

  return plans.map((p) => ({
    ...p,
    price: Number(p.price),
    features: p.features as string[],
  }))
}

export async function getUserSubscription(userId: string) {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  })

  if (!sub) return null

  return {
    ...sub,
    plan: { ...sub.plan, price: Number(sub.plan.price), features: sub.plan.features as string[] },
  }
}

export async function assignFreePlan(userId: string) {
  const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } })
  if (!freePlan) return null

  const now = new Date()
  const end = new Date(now.getFullYear() + 100, 0, 1)

  const sub = await prisma.userSubscription.create({
    data: {
      userId,
      planId: freePlan.id,
      status: "TRIALING",
      currentPeriodStart: now,
      currentPeriodEnd: end,
      trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    },
    include: { plan: true },
  })

  return { ...sub, plan: { ...sub.plan, price: Number(sub.plan.price), features: sub.plan.features as string[] } }
}

export async function canCreateCircle(userId: string): Promise<{ allowed: boolean; limit: number; current: number; message?: string }> {
  const sub = await getUserSubscription(userId)

  if (!sub) return { allowed: false, limit: 0, current: 0, message: "No subscription found" }

  const circleLimit = sub.plan.circleLimit

  const activeCircles = await prisma.circleMember.count({
    where: { userId, circle: { isActive: true } },
  })

  if (activeCircles >= circleLimit) {
    return {
      allowed: false,
      limit: circleLimit,
      current: activeCircles,
      message:
        sub.plan.slug === "free"
          ? `Free plan limited to ${circleLimit} circles. Upgrade to Premium for unlimited circles.`
          : `You've reached your plan limit of ${circleLimit} circles.`,
    }
  }

  return { allowed: true, limit: circleLimit, current: activeCircles }
}

export async function enforceCircleLimit(userId: string) {
  const check = await canCreateCircle(userId)
  if (!check.allowed) throw new Error(check.message)
}

export async function activateSubscription(
  userId: string,
  planId: string,
  transactionId: string
) {
  const now = new Date()
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 23, 59, 59)

  const existingSub = await prisma.userSubscription.findUnique({
    where: { userId },
  })

  let sub
  if (existingSub) {
    sub = await prisma.userSubscription.update({
      where: { userId },
      data: {
        planId,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        cancelledAt: null,
      },
      include: { plan: true },
    })
  } else {
    sub = await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    })
  }

  // Link transaction
  try {
    await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { subscriptionId: sub.id },
    })
  } catch {}

  return { ...sub, plan: { ...sub.plan, price: Number(sub.plan.price) } }
}
