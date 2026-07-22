import { prisma } from "@/lib/prisma"
import { isPrimaryOwnerUser } from "@/lib/owner-email"

const FALLBACK_FEATURES: Record<string, Record<string, boolean | number>> = {
  free: {
    AI_ASSISTANT: false,
    COMMUNITY_FEED: true,
    EVENTS: true,
    POLLS: true,
    WALLET_TRACKING: false,
    REPORTS: false,
    CSV_EXPORT: false,
    DISCOVER_LISTING: false,
    PUBLIC_CIRCLES: false,
    VERIFICATION: false,
    PRIORITY_SUPPORT: false,
    CUSTOM_BRANDING: false,
    API_ACCESS: false,
    BULK_OPERATIONS: false,
    ADVANCED_ANALYTICS: false,
    MAX_CIRCLES: 3,
    MAX_MEMBERS: 50,
    AI_MESSAGE_LIMIT: 0,
    STORAGE_LIMIT_MB: 5,
    API_REQUEST_LIMIT: 0,
  },
  premium: {
    AI_ASSISTANT: true,
    COMMUNITY_FEED: true,
    EVENTS: true,
    POLLS: true,
    WALLET_TRACKING: true,
    REPORTS: true,
    CSV_EXPORT: true,
    DISCOVER_LISTING: false,
    PUBLIC_CIRCLES: false,
    VERIFICATION: false,
    PRIORITY_SUPPORT: false,
    CUSTOM_BRANDING: false,
    API_ACCESS: false,
    BULK_OPERATIONS: false,
    ADVANCED_ANALYTICS: true,
    MAX_CIRCLES: 999,
    MAX_MEMBERS: 999,
    AI_MESSAGE_LIMIT: 100,
    STORAGE_LIMIT_MB: 100,
    API_REQUEST_LIMIT: 0,
  },
  community: {
    AI_ASSISTANT: true,
    COMMUNITY_FEED: true,
    EVENTS: true,
    POLLS: true,
    WALLET_TRACKING: true,
    REPORTS: true,
    CSV_EXPORT: true,
    DISCOVER_LISTING: true,
    PUBLIC_CIRCLES: true,
    VERIFICATION: true,
    PRIORITY_SUPPORT: true,
    CUSTOM_BRANDING: false,
    API_ACCESS: false,
    BULK_OPERATIONS: true,
    ADVANCED_ANALYTICS: true,
    MAX_CIRCLES: 999,
    MAX_MEMBERS: 999,
    AI_MESSAGE_LIMIT: 500,
    STORAGE_LIMIT_MB: 500,
    API_REQUEST_LIMIT: 0,
  },
}

export async function getUserSubscription(userId: string) {
  return prisma.userSubscription.findFirst({
    where: { userId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    include: {
      plan: {
        include: {
          planFeatures: true,
        },
      },
    },
  })
}

export async function getUserPlanFeatures(userId: string): Promise<Record<string, boolean | number>> {
  const sub = await getUserSubscription(userId)
  if (!sub) {
    return FALLBACK_FEATURES.free
  }

  const fromDb: Record<string, boolean | number> = {}
  if (sub.plan.planFeatures.length > 0) {
    for (const f of sub.plan.planFeatures) {
      if (f.isEnabled) {
        const raw = f.value
        if (typeof raw === "boolean") fromDb[f.key] = raw
        else if (typeof raw === "number") fromDb[f.key] = raw
        else if (typeof raw === "string") {
          const lower = raw.toLowerCase()
          if (lower === "true") fromDb[f.key] = true
          else if (lower === "false") fromDb[f.key] = false
          else { const n = Number(raw); (fromDb as Record<string, unknown>)[f.key] = Number.isNaN(n) ? raw : n }
        } else {
          fromDb[f.key] = false
        }
      } else {
        fromDb[f.key] = false
      }
    }
  }

  const fallback = FALLBACK_FEATURES[sub.plan.slug] || FALLBACK_FEATURES.free

  // DB features override fallback; missing keys use fallback
  const merged: Record<string, boolean | number> = { ...fallback }
  for (const [k, v] of Object.entries(fromDb)) {
    if (v !== undefined) merged[k] = v
  }

  // Plan-level limits override if set
  if (sub.plan.circleLimit != null) merged.MAX_CIRCLES = sub.plan.circleLimit
  if (sub.plan.memberLimit != null) merged.MAX_MEMBERS = sub.plan.memberLimit
  if (sub.plan.aiMessageLimit != null) merged.AI_MESSAGE_LIMIT = sub.plan.aiMessageLimit
  if (sub.plan.storageLimitMb != null) merged.STORAGE_LIMIT_MB = sub.plan.storageLimitMb
  if (sub.plan.apiRequestLimit != null) merged.API_REQUEST_LIMIT = sub.plan.apiRequestLimit

  return merged
}

export async function hasFeature(userId: string, featureKey: string): Promise<boolean> {
  if (await isPrimaryOwnerUser(userId)) return true
  const features = await getUserPlanFeatures(userId)
  const val = features[featureKey]
  if (val === undefined || val === false || val === 0) return false
  return true
}

export async function getFeatureLimit(userId: string, featureKey: string): Promise<number> {
  const features = await getUserPlanFeatures(userId)
  const val = features[featureKey]
  if (val === undefined) return 0
  return typeof val === "number" ? val : (val ? 999 : 0)
}

export async function canCreateCircle(userId: string): Promise<{ allowed: boolean; limit: number; current: number; message?: string }> {
  const limit = await getFeatureLimit(userId, "MAX_CIRCLES")
  if (limit === 0) return { allowed: false, limit: 0, current: 0, message: "Circle creation is not available on your plan." }

  const activeCircles = await prisma.circleMember.count({ where: { userId, circle: { isActive: true } } })
  if (activeCircles >= limit) {
    return {
      allowed: false,
      limit,
      current: activeCircles,
      message: `You've reached your limit of ${limit} circles. Upgrade your plan for more.`,
    }
  }
  return { allowed: true, limit, current: activeCircles }
}

export async function enforceCircleLimit(userId: string): Promise<void> {
  const check = await canCreateCircle(userId)
  if (!check.allowed) throw new Error(check.message || "Circle limit reached")
}

export async function getCurrentPlanSlug(userId: string): Promise<string> {
  const sub = await getUserSubscription(userId)
  return sub?.plan?.slug || "free"
}

export const DEFAULT_FEATURE_SEEDS = {
  free: [
    { key: "AI_ASSISTANT", label: "AI Assistant", isEnabled: false },
    { key: "COMMUNITY_FEED", label: "Community Feed", isEnabled: true },
    { key: "EVENTS", label: "Events", isEnabled: true },
    { key: "POLLS", label: "Polls", isEnabled: true },
    { key: "WALLET_TRACKING", label: "Wallet Tracking", isEnabled: false },
    { key: "REPORTS", label: "Reports", isEnabled: false },
    { key: "CSV_EXPORT", label: "CSV Export", isEnabled: false },
    { key: "MAX_CIRCLES", label: "Max Circles", valueType: "NUMBER" as const, value: 3 },
    { key: "MAX_MEMBERS", label: "Max Members", valueType: "NUMBER" as const, value: 50 },
    { key: "AI_MESSAGE_LIMIT", label: "AI Message Limit", valueType: "NUMBER" as const, value: 0 },
    { key: "STORAGE_LIMIT_MB", label: "Storage Limit (MB)", valueType: "NUMBER" as const, value: 5 },
  ],
  premium: [
    { key: "AI_ASSISTANT", label: "AI Assistant", isEnabled: true },
    { key: "COMMUNITY_FEED", label: "Community Feed", isEnabled: true },
    { key: "EVENTS", label: "Events", isEnabled: true },
    { key: "POLLS", label: "Polls", isEnabled: true },
    { key: "WALLET_TRACKING", label: "Wallet Tracking", isEnabled: true },
    { key: "REPORTS", label: "Reports", isEnabled: true },
    { key: "CSV_EXPORT", label: "CSV Export", isEnabled: true },
    { key: "ADVANCED_ANALYTICS", label: "Advanced Analytics", isEnabled: true },
    { key: "MAX_CIRCLES", label: "Max Circles", valueType: "NUMBER" as const, value: 999 },
    { key: "MAX_MEMBERS", label: "Max Members", valueType: "NUMBER" as const, value: 999 },
    { key: "AI_MESSAGE_LIMIT", label: "AI Message Limit", valueType: "NUMBER" as const, value: 100 },
    { key: "STORAGE_LIMIT_MB", label: "Storage Limit (MB)", valueType: "NUMBER" as const, value: 100 },
  ],
  community: [
    { key: "AI_ASSISTANT", label: "AI Assistant", isEnabled: true },
    { key: "COMMUNITY_FEED", label: "Community Feed", isEnabled: true },
    { key: "EVENTS", label: "Events", isEnabled: true },
    { key: "POLLS", label: "Polls", isEnabled: true },
    { key: "WALLET_TRACKING", label: "Wallet Tracking", isEnabled: true },
    { key: "REPORTS", label: "Reports", isEnabled: true },
    { key: "CSV_EXPORT", label: "CSV Export", isEnabled: true },
    { key: "DISCOVER_LISTING", label: "Discover Listing", isEnabled: true },
    { key: "PUBLIC_CIRCLES", label: "Public Circles", isEnabled: true },
    { key: "VERIFICATION", label: "Verification", isEnabled: true },
    { key: "PRIORITY_SUPPORT", label: "Priority Support", isEnabled: true },
    { key: "BULK_OPERATIONS", label: "Bulk Operations", isEnabled: true },
    { key: "ADVANCED_ANALYTICS", label: "Advanced Analytics", isEnabled: true },
    { key: "MAX_CIRCLES", label: "Max Circles", valueType: "NUMBER" as const, value: 999 },
    { key: "MAX_MEMBERS", label: "Max Members", valueType: "NUMBER" as const, value: 999 },
    { key: "AI_MESSAGE_LIMIT", label: "AI Message Limit", valueType: "NUMBER" as const, value: 500 },
    { key: "STORAGE_LIMIT_MB", label: "Storage Limit (MB)", valueType: "NUMBER" as const, value: 500 },
  ],
}

export async function seedDefaultPlanFeatures() {
  for (const [slug, features] of Object.entries(DEFAULT_FEATURE_SEEDS)) {
    const plan = await prisma.plan.findUnique({ where: { slug } })
    if (!plan) continue
    for (const feat of features) {
      await prisma.planFeature.upsert({
        where: { planId_key: { planId: plan.id, key: feat.key } },
        create: {
          planId: plan.id,
          key: feat.key,
          label: feat.label,
          value: (feat as { value?: unknown }).value ?? true,
          valueType: ((feat as { valueType?: string }).valueType || "BOOLEAN") as "BOOLEAN",
          isEnabled: feat.isEnabled ?? true,
        },
        update: { label: feat.label },
      })
    }
  }
}
