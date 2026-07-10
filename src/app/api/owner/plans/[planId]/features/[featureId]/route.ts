import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { requireOwnerPermission } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

async function checkAdmin() {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireOwnerPermission(s.user.id, PERMISSIONS.PLANS_MANAGE)
  return s.user.id
}

export async function PATCH(req: Request, { params }: { params: Promise<{ planId: string; featureId: string }> }) {
  let uid: string
  try { uid = await checkAdmin() } catch (e) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  const { featureId } = await params
  const body = await req.json()
  const safe: Record<string, unknown> = {}
  if (body.value !== undefined) safe.value = body.value
  if (body.isEnabled !== undefined) safe.isEnabled = body.isEnabled
  if (body.label !== undefined) safe.label = body.label
  if (body.sortOrder !== undefined) safe.sortOrder = body.sortOrder
  const updated = await prisma.planFeature.update({ where: { id: featureId }, data: safe as Parameters<typeof prisma.planFeature.update>[0]["data"] })
  await createAuditLog({ userId: uid, action: "OWNER_PLAN_FEATURE_UPDATED", entityType: "PlanFeature", entityId: featureId, newValues: safe })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ planId: string; featureId: string }> }) {
  let uid: string
  try { uid = await checkAdmin() } catch (e) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  const { featureId } = await params
  await prisma.planFeature.delete({ where: { id: featureId } })
  await createAuditLog({ userId: uid, action: "OWNER_PLAN_FEATURE_REMOVED", entityType: "PlanFeature", entityId: featureId })
  return NextResponse.json({ ok: true })
}
