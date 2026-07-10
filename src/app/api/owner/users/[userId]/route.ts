import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireOwnerPermission } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

async function checkAdmin() { const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized"); await requireOwnerPermission(s.user.id, PERMISSIONS.USERS_EDIT); return s.user.id }

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  let adminId: string
  try { adminId = await checkAdmin() } catch (e) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  const { userId } = await params
  const data = await req.json()
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) update.name = data.name
  if (data.email !== undefined) update.email = data.email
  if (data.phone !== undefined) update.phone = data.phone || null
  if (data.currency !== undefined) update.currency = data.currency
  try {
    const user = await prisma.user.update({ where: { id: userId }, data: update as any, select: { id: true, name: true, email: true, phone: true, currency: true, isSuspended: true } })
    return NextResponse.json(user)
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  let adminId: string
  try { adminId = await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const { userId } = await params
  const action = new URL(req.url).pathname.split("/").pop()

  if (action === "suspend") {
    const { reason } = await req.json().catch(() => ({}))
    const user = await prisma.user.update({ where: { id: userId }, data: { isSuspended: true, suspendedAt: new Date(), suspendedById: adminId!, suspensionReason: reason || null }, select: { id: true, name: true, email: true, phone: true, currency: true, isSuspended: true, suspendedAt: true, suspensionReason: true } })
    return NextResponse.json(user)
  }
  if (action === "reactivate") {
    const user = await prisma.user.update({ where: { id: userId }, data: { isSuspended: false, suspendedAt: null }, select: { id: true, name: true, email: true, phone: true, currency: true, isSuspended: true } })
    return NextResponse.json(user)
  }
  if (action === "change-plan") {
    const { planSlug } = await req.json()
    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    const now = new Date()
    const sub = await prisma.userSubscription.upsert({
      where: { userId },
      create: { userId, planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()) },
      update: { planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()) },
      include: { plan: true },
    })
    return NextResponse.json(sub)
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
