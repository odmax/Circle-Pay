import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DEFAULTS = {
  theme: "system",
  defaultDashboardView: "overview",
  preferredCurrency: null as string | null,
  compactMode: false,
  showOnboardingTips: true,
  defaultCircleId: null as string | null,
  dashboardWidgets: ["circles", "totalPool", "goals", "pending", "recentActivity", "quickActions", "goalProgress"],
}

export async function GET() {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: s.user.id }, select: { settings: true, currency: true } })
  const stored = (user?.settings as Record<string, unknown>)?.userPreferences as Record<string, unknown> | undefined
  return NextResponse.json({ ...DEFAULTS, preferredCurrency: user?.currency || DEFAULTS.preferredCurrency, ...stored })
}

export async function PATCH(req: Request) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const current = await prisma.user.findUnique({ where: { id: s.user.id }, select: { settings: true } })
  const existing = (current?.settings as Record<string, unknown>) || {}
  const merged = { ...DEFAULTS, ...(existing.userPreferences as Record<string, unknown> || {}), ...body }
  await prisma.user.update({ where: { id: s.user.id }, data: { settings: { ...existing, userPreferences: merged } as any } })
  return NextResponse.json(merged)
}
