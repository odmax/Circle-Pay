import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireOwnerPermission } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

async function checkAdmin(): Promise<string> {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireOwnerPermission(s.user.id, PERMISSIONS.SUBSCRIPTIONS_EDIT)
  return s.user.id
}

async function updateStatus(subscriptionId: string, status: string) {
  const sub = await prisma.userSubscription.update({ where: { id: subscriptionId }, data: { status: status as any, ...(status === "CANCELLED" ? { cancelledAt: new Date() } : { cancelledAt: null }) } })
  return NextResponse.json(sub)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ subscriptionId: string }> }) {
  try { await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  try {
    const { subscriptionId } = await params
    const { planSlug, status, extendDays } = await req.json()
    const data: Record<string, unknown> = {}
    if (planSlug) { const plan = await prisma.plan.findUnique({ where: { slug: planSlug } }); if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 }); data.planId = plan.id }
    if (status) data.status = status
    if (extendDays) {
      const sub = await prisma.userSubscription.findUnique({ where: { id: subscriptionId } })
      if (sub) data.currentPeriodEnd = new Date(new Date(sub.currentPeriodEnd).getTime() + extendDays * 24 * 60 * 60 * 1000)
    }
    const sub = await prisma.userSubscription.update({ where: { id: subscriptionId }, data, include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } } })
    return NextResponse.json(sub)
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}

export async function POST(req: Request, { params }: { params: Promise<{ subscriptionId: string }> }) {
  try { await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  try {
    const { subscriptionId } = await params
    const action = new URL(req.url).pathname.split("/").pop()
    if (action === "cancel") return updateStatus(subscriptionId, "CANCELLED")
    if (action === "reactivate") return updateStatus(subscriptionId, "ACTIVE")
    if (action === "extend") {
      const sub = await prisma.userSubscription.findUnique({ where: { id: subscriptionId } })
      if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const updated = await prisma.userSubscription.update({ where: { id: subscriptionId }, data: { currentPeriodEnd: new Date(new Date(sub.currentPeriodEnd).getTime() + 30 * 24 * 60 * 60 * 1000) } })
      return NextResponse.json(updated)
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
