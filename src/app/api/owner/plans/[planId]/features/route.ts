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

export async function POST(req: Request, { params }: { params: Promise<{ planId: string }> }) {
  let uid: string
  try { uid = await checkAdmin() } catch (e) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  const { planId } = await params
  const body = await req.json()
  const { key, label, value, valueType, isEnabled, sortOrder } = body
  if (!key || !label) return NextResponse.json({ error: "key and label required" }, { status: 400 })
  try {
    const feat = await prisma.planFeature.create({ data: { planId, key, label, value: value ?? true, valueType: valueType || "BOOLEAN", isEnabled: isEnabled !== false, sortOrder: sortOrder ?? 0 } })
    await createAuditLog({ userId: uid, action: "OWNER_PLAN_FEATURE_ADDED", entityType: "PlanFeature", entityId: feat.id, newValues: { key, label } })
    return NextResponse.json(feat, { status: 201 })
  } catch (e) { return NextResponse.json({ error: "Duplicate key or invalid data" }, { status: 400 }) }
}
