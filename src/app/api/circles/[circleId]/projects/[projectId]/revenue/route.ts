import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createProjectRevenue } from "@/lib/services/project-roi.service"

async function checkAdmin(circleId: string, userId: string) { const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } }); if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) throw new Error("Forbidden") }

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { projectId } = await params
  return NextResponse.json(await prisma.projectRevenue.findMany({ where: { projectId }, include: { asset: { select: { name: true } } }, orderBy: { createdAt: "desc" } }))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  try { await checkAdmin(circleId, s.user.id); return NextResponse.json(await createProjectRevenue(projectId, circleId, s.user.id, await req.json()), { status: 201 }) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}
