import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createFundingRound, getProjectFunding, openFundingRound, closeFundingRound } from "@/lib/services/project-funding.service"
import { requireProjectInCircle } from "@/lib/services/project.service"

async function checkAdmin(circleId: string, userId: string) {
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) throw new Error("Forbidden")
}

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; roundId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId, roundId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  try {
    if (action === "get") return NextResponse.json(await getProjectFunding(projectId))
    if (action === "create") {
      await checkAdmin(circleId, s.user.id)
      const body = await req.json()
      return NextResponse.json(await createFundingRound(projectId, s.user.id, body), { status: 201 })
    }
    if (!roundId) return NextResponse.json({ error: "Missing roundId" }, { status: 400 })
    await checkAdmin(circleId, s.user.id)
    if (action === "open") return NextResponse.json(await openFundingRound(roundId))
    if (action === "close") return NextResponse.json(await closeFundingRound(roundId))
    if (action === "cancel") return NextResponse.json(await prisma.projectFundingRound.update({ where: { id: roundId }, data: { status: "CANCELLED" } }))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: e instanceof Error && e.message === "Forbidden" ? 403 : 400 }) }
}

export const GET = (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string }> }) => handle(req, ctx as any, "get")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string; roundId?: string }> }) => {
  const url = new URL(req.url)
  const action = url.pathname.endsWith("/open") ? "open" : url.pathname.endsWith("/close") ? "close" : url.pathname.endsWith("/cancel") ? "cancel" : "create"
  return handle(req, ctx, action)
}
