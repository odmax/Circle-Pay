import { prisma } from "@/lib/prisma"

export async function getPlatformSettings() {
  const settings = await prisma.platformSetting.findMany()
  const map: Record<string, unknown> = {}
  for (const s of settings) map[s.key] = s.value
  return map
}

export async function updatePlatformSetting(key: string, value: unknown, userId: string) {
  return prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: value as any, type: typeof value === "boolean" ? "BOOLEAN" : typeof value === "number" ? "NUMBER" : "STRING", updatedById: userId },
    update: { value: value as any, updatedById: userId },
  })
}

export async function seedDefaultPlatformSettings() {
  const defaults: Record<string, { value: unknown; type: string; isPublic?: boolean; description?: string }> = {
    maintenanceMode: { value: false, type: "BOOLEAN", isPublic: true, description: "Site-wide maintenance mode" },
    registrationEnabled: { value: true, type: "BOOLEAN", isPublic: true },
    googleLoginEnabled: { value: true, type: "BOOLEAN", isPublic: true },
    discoverEnabled: { value: true, type: "BOOLEAN", isPublic: true },
    aiAssistantEnabled: { value: true, type: "BOOLEAN", isPublic: true },
    walletTrackingEnabled: { value: true, type: "BOOLEAN", isPublic: true },
    defaultCurrency: { value: "ZAR", type: "STRING", isPublic: true },
  }
  for (const [key, data] of Object.entries(defaults)) {
    await prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: data.value as any, type: data.type as any, isPublic: data.isPublic || false, description: data.description },
      update: {},
    })
  }
}

export async function getFeatureFlags() {
  return prisma.featureFlag.findMany()
}

export async function updateFeatureFlag(key: string, isEnabled: boolean, userId: string) {
  return prisma.featureFlag.upsert({
    where: { key },
    create: { key, name: key, isEnabled, updatedById: userId },
    update: { isEnabled, updatedById: userId },
  })
}

export async function isFeatureEnabled(key: string) {
  const flag = await prisma.featureFlag.findUnique({ where: { key } })
  return flag?.isEnabled ?? true
}
