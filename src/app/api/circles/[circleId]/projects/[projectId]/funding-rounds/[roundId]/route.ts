import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createFundingRound, getProjectFunding, openFundingRound, closeFundingRound } from "@/lib/services/project-funding.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; roundId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId, roundId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  try {
    if (action === "get") return NextResponse.json(await getProjectFunding(projectId))
    if (action === "create") {
      const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE })
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const body = await req.json()
      return NextResponse.json(await createFundingRound(projectId, s.user.id, body), { status: 201 })
    }
    if (!roundId) return NextResponse.json({ error: "Missing roundId" }, { status: 400 })
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (action === "open") return NextResponse.json(await openFundingRound(roundId))
    if (action === "close") return NextResponse.json(await closeFundingRound(roundId))
    if (action === "cancel") return NextResponse.json(await prisma.projectFundingRound.update({ where: { id: roundId }, data: { status: "CANCELLED" } }))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}

export const GET = (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string }> }) => handle(req, ctx as any, "get")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string; roundId?: string }> }) => {
  const url = new URL(req.url)
  const action = url.pathname.endsWith("/open") ? "open" : url.pathname.endsWith("/close") ? "close" : url.pathname.endsWith("/cancel") ? "cancel" : "create"
  return handle(req, ctx, action)
}
