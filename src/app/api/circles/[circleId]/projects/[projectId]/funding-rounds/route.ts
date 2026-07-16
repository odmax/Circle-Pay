import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProjectFunding } from "@/lib/services/project-funding.service"
import { requireProjectInCircle } from "@/lib/services/project.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  return NextResponse.json(await getProjectFunding(projectId))
}
