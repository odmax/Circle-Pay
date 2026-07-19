import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createProjectContribution, submitProjectContributionProof, confirmProjectContribution, rejectProjectContribution, getProjectFunding } from "@/lib/services/project-funding.service"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; contributionId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId, contributionId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  try {
    if (action === "get") return NextResponse.json(await getProjectFunding(projectId).then((d) => d.contributions))
    if (action === "create") {
      return NextResponse.json(await createProjectContribution(projectId, s.user.id, await req.json()), { status: 201 })
    }
    if (!contributionId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    if (action === "proof") {
      const { reference } = await req.json()
      return NextResponse.json(await submitProjectContributionProof(contributionId, s.user.id, reference || ""))
    }
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_APPROVE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (action === "confirm") return NextResponse.json(await confirmProjectContribution(contributionId, s.user.id))
    if (action === "reject") {
      const { reason } = await req.json()
      return NextResponse.json(await rejectProjectContribution(contributionId, s.user.id, reason))
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}

export const GET = (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string }> }) => handle(req, ctx as any, "get")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string; contributionId?: string }> }) => {
  const url = new URL(req.url)
  const action = url.pathname.endsWith("/proof") ? "proof" : url.pathname.endsWith("/confirm") ? "confirm" : url.pathname.endsWith("/reject") ? "reject" : "create"
  return handle(req, ctx, action)
}
