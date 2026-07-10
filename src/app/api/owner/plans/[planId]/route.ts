import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { requireOwnerPermission } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

async function checkAdmin(action: string) {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireOwnerPermission(s.user.id, action)
  return s.user.id
}

export async function GET(_req: Request, { params }: { params: Promise<{ planId: string }> }) {
  try { await checkAdmin(PERMISSIONS.PLANS_MANAGE) } catch (e) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  const { planId } = await params
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      subscriptions: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 100 },
      paymentTransactions: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
      planFeatures: { orderBy: { sortOrder: "asc" } },
      _count: { select: { subscriptions: true } },
    },
  })
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Compute revenue stats
  const paid = plan.paymentTransactions.filter((p) => p.status === "PAID")
  const failed = plan.paymentTransactions.filter((p) => p.status === "FAILED")
  const revenue = paid.reduce((sum, p) => sum + Number(p.amount), 0)

  return NextResponse.json({ ...plan, revenue, paidCount: paid.length, failedCount: failed.length })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ planId: string }> }) {
  let uid: string
  try { uid = await checkAdmin(PERMISSIONS.PLANS_MANAGE) } catch (e) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  const { planId } = await params
  const body = await req.json()
  const safe: Record<string, unknown> = {}
  const stringFields = ["name", "slug", "description", "currency", "interval", "supportLevel"]
  const intFields = ["circleLimit", "memberLimit", "aiMessageLimit", "storageLimitMb", "apiRequestLimit", "sortOrder", "trialDays"]
  const boolFields = ["isPublic", "isArchived"]
  const jsonFields = ["features"]

  for (const f of stringFields) if (body[f] !== undefined) safe[f] = body[f]
  for (const f of intFields) if (body[f] !== undefined) safe[f] = body[f]
  for (const f of boolFields) if (body[f] !== undefined) safe[f] = body[f]
  for (const f of jsonFields) if (body[f] !== undefined) safe[f] = body[f]

  if (body.price !== undefined) {
    if (typeof body.price === "number" && body.price >= 0) safe.price = body.price
    else return NextResponse.json({ error: "Price must be >= 0" }, { status: 400 })
  }
  if (body.slug) {
    const dup = await prisma.plan.findUnique({ where: { slug: body.slug } })
    if (dup && dup.id !== planId) return NextResponse.json({ error: "Slug already in use" }, { status: 409 })
  }

  const prev = await prisma.plan.findUnique({ where: { id: planId }, select: { name: true, price: true } })
  const updated = await prisma.plan.update({ where: { id: planId }, data: safe as Parameters<typeof prisma.plan.update>[0]["data"] })
  const action = body.price !== undefined ? "OWNER_PLAN_PRICE_CHANGED" : "OWNER_PLAN_UPDATED"
  await createAuditLog({ userId: uid, action, entityType: "Plan", entityId: planId, oldValues: prev ? { name: prev.name, price: prev.price } : null, newValues: safe })
  return NextResponse.json(updated)
}
