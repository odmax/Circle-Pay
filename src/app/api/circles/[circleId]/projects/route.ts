import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProjectsForCircle, createProject } from "@/lib/services/project.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json(await getProjectsForCircle(circleId))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const body = await req.json()
    return NextResponse.json(await createProject(circleId, s.user.id, body), { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
