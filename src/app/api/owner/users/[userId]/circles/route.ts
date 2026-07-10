import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function checkAdmin() { const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized"); const a = await prisma.internalAdmin.findUnique({ where: { userId: s.user.id } }); if (!a?.isActive) throw new Error("Forbidden"); return s.user.id }

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try { await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const { userId } = await params
  try {
    const { circleId, role } = await req.json()
    if (!circleId) return NextResponse.json({ error: "circleId required" }, { status: 400 })
    const circle = await prisma.circle.findUnique({ where: { id: circleId } })
    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    const existing = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
    if (existing) return NextResponse.json({ error: "Already a member" }, { status: 400 })
    const member = await prisma.circleMember.create({ data: { circleId, userId, role: (role || "MEMBER") as any } })
    return NextResponse.json(member, { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
