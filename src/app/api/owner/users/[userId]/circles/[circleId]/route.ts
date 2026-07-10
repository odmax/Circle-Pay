import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function checkAdmin() { const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized"); const a = await prisma.internalAdmin.findUnique({ where: { userId: s.user.id } }); if (!a?.isActive) throw new Error("Forbidden") }

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string; circleId: string }> }) {
  try { await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const { userId, circleId } = await params
  try {
    const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 404 })
    if (member.role === "OWNER") {
      const owners = await prisma.circleMember.count({ where: { circleId, role: "OWNER" } })
      if (owners <= 1) return NextResponse.json({ error: "Cannot remove last owner" }, { status: 400 })
    }
    await prisma.circleMember.delete({ where: { id: member.id } })
    return NextResponse.json({ success: true })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string; circleId: string }> }) {
  try { await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const { userId, circleId } = await params
  try {
    const { role } = await req.json()
    const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 404 })
    if (member.role === "OWNER" && role !== "OWNER") {
      const owners = await prisma.circleMember.count({ where: { circleId, role: "OWNER" } })
      if (owners <= 1) return NextResponse.json({ error: "Cannot demote last owner" }, { status: 400 })
    }
    const updated = await prisma.circleMember.update({ where: { id: member.id }, data: { role: role as any } })
    return NextResponse.json(updated)
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
