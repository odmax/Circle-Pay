import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

async function checkSuper() {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  const admin = await prisma.internalAdmin.findUnique({ where: { userId: s.user.id } })
  if (!admin?.isActive || admin.role !== "SUPER_ADMIN") throw new Error("Forbidden")
  return s.user.id
}

export async function GET() {
  try { await checkSuper() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const admins = await prisma.internalAdmin.findMany({ include: { user: { select: { id: true, name: true, email: true, image: true, createdAt: true } }, }, orderBy: { createdAt: "desc" } })
  return NextResponse.json(admins)
}

export async function POST(req: Request) {
  let uid: string
  try { uid = await checkSuper() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const { email, role } = await req.json()
  if (!email || !role) return NextResponse.json({ error: "email and role required" }, { status: 400 })
  const validRoles = ["SUPER_ADMIN", "ADMIN", "SUPPORT", "FINANCE"]
  if (!validRoles.includes(role)) return NextResponse.json({ error: `Invalid role. Use: ${validRoles.join(", ")}` }, { status: 400 })
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ error: "User not found with that email" }, { status: 404 })
  const existing = await prisma.internalAdmin.findUnique({ where: { userId: user.id } })
  if (existing) return NextResponse.json({ error: "User is already an admin" }, { status: 409 })
  const created = await prisma.internalAdmin.create({ data: { userId: user.id, role }, include: { user: { select: { name: true, email: true } } } })
  await createAuditLog({ userId: uid, action: "OWNER_ADMIN_CREATED", entityType: "InternalAdmin", entityId: created.id, newValues: { email: user.email, role } })
  return NextResponse.json(created, { status: 201 })
}
