import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DEFAULTS = {
  contributions: true, expenses: true, goals: true,
  wallet: true, events: true, polls: true,
  support: true, broadcasts: true, system: true,
}

export async function GET() {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: s.user.id }, select: { settings: true } })
  const prefs = (user?.settings as Record<string, unknown>)?.notificationPreferences || DEFAULTS
  return NextResponse.json(prefs)
}

export async function PATCH(req: Request) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const current = await prisma.user.findUnique({ where: { id: s.user.id }, select: { settings: true } })
  const existing = (current?.settings as Record<string, unknown>) || {}
  const merged: Record<string, boolean> = { ...DEFAULTS }
  const incoming = body as Record<string, boolean>
  for (const k of Object.keys(DEFAULTS)) {
    if (incoming[k] !== undefined) merged[k] = !!incoming[k]
  }
  await prisma.user.update({
    where: { id: s.user.id },
    data: { settings: { ...existing, notificationPreferences: merged } as any },
  })
  return NextResponse.json(merged)
}
