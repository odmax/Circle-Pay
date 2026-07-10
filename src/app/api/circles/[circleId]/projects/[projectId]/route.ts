import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProject, updateProject, archiveProject } from "@/lib/services/project.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { projectId } = await params
  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const body = await req.json()
    if (body.action === "archive") return NextResponse.json(await archiveProject(projectId))
    return NextResponse.json(await updateProject(projectId, body))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
