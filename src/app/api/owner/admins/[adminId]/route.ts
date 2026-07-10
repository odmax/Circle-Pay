import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

async function checkSuper() {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  const admin = await prisma.internalAdmin.findUnique({ where: { userId: s.user.id } })
  if (!admin?.isActive || admin.role !== "SUPER_ADMIN") throw new Error("Forbidden")
  return { userId: s.user.id, adminId: admin.id }
}

// change role
export async function PATCH(req: Request, { params }: { params: Promise<{ adminId: string }> }) {
  const { adminId } = await params
  let uid: string
  try { ({ userId: uid } = await checkSuper()) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }

  const target = await prisma.internalAdmin.findUnique({ where: { id: adminId }, include: { user: { select: { email: true } } } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Safety: cannot demote the last SUPER_ADMIN
  const { role, isActive } = await req.json()

  if (role !== undefined) {
    if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      const superCount = await prisma.internalAdmin.count({ where: { role: "SUPER_ADMIN", isActive: true } })
      if (superCount <= 1) return NextResponse.json({ error: "Cannot demote the last active SUPER_ADMIN" }, { status: 400 })
    }
    await prisma.internalAdmin.update({ where: { id: adminId }, data: { role } })
    await createAuditLog({ userId: uid, action: "OWNER_ADMIN_ROLE_CHANGED", entityType: "InternalAdmin", entityId: adminId, oldValues: { role: target.role }, newValues: { role } })
  }

  if (isActive !== undefined) {
    if (!isActive && target.userId === uid) return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 })
    await prisma.internalAdmin.update({ where: { id: adminId }, data: { isActive } })
    const action = isActive ? "OWNER_ADMIN_ACTIVATED" : "OWNER_ADMIN_DEACTIVATED"
    await createAuditLog({ userId: uid, action, entityType: "InternalAdmin", entityId: adminId, newValues: { isActive } })
  }

  return NextResponse.json({ ok: true })
}

// remove admin access
export async function DELETE(_req: Request, { params }: { params: Promise<{ adminId: string }> }) {
  const { adminId } = await params
  let uid: string
  try { ({ userId: uid } = await checkSuper()) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }

  const target = await prisma.internalAdmin.findUnique({ where: { id: adminId }, include: { user: { select: { email: true } } } })
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (target.userId === uid) return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 })

  // Safety: cannot remove the last active SUPER_ADMIN
  if (target.role === "SUPER_ADMIN") {
    const superCount = await prisma.internalAdmin.count({ where: { role: "SUPER_ADMIN", isActive: true } })
    if (superCount <= 1) return NextResponse.json({ error: "Cannot remove the last active SUPER_ADMIN" }, { status: 400 })
  }

  await prisma.internalAdmin.delete({ where: { id: adminId } })
  await createAuditLog({ userId: uid, action: "OWNER_ADMIN_ACCESS_REMOVED", entityType: "InternalAdmin", entityId: adminId, oldValues: { role: target.role, email: target.user.email } })
  return NextResponse.json({ ok: true })
}
