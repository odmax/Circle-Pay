import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireOwnerPermission } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { await requireOwnerPermission(session.user.id, PERMISSIONS.USERS_EDIT) } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }

  const { userId } = await params
  const { planSlug } = await req.json()
  const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
  try {
    const now = new Date()
    const sub = await prisma.userSubscription.upsert({
      where: { userId },
      create: { userId, planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()) },
      update: { planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()) },
      include: { plan: { select: { name: true, slug: true } } },
    })
    return NextResponse.json(sub)
  } catch (e) { return NextResponse.json({ error: "Failed to update plan" }, { status: 400 }) }
}
