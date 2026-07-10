import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createProjectContribution, submitProjectContributionProof, confirmProjectContribution, rejectProjectContribution, getProjectFunding } from "@/lib/services/project-funding.service"

async function checkAdmin(circleId: string, userId: string) {
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) throw new Error("Forbidden")
}

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; contributionId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId, contributionId } = await params
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
    await checkAdmin(circleId, s.user.id)
    if (action === "confirm") return NextResponse.json(await confirmProjectContribution(contributionId, s.user.id))
    if (action === "reject") {
      const { reason } = await req.json()
      return NextResponse.json(await rejectProjectContribution(contributionId, s.user.id, reason))
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: e instanceof Error && e.message === "Forbidden" ? 403 : 400 }) }
}

export const GET = (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string }> }) => handle(req, ctx as any, "get")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string; contributionId?: string }> }) => {
  const url = new URL(req.url)
  const action = url.pathname.endsWith("/proof") ? "proof" : url.pathname.endsWith("/confirm") ? "confirm" : url.pathname.endsWith("/reject") ? "reject" : "create"
  return handle(req, ctx, action)
}
