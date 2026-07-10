import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureCircleWorkflow, getCircleWorkflow, completeWorkflowStep, skipWorkflowStep, resetWorkflow, startNextCycle } from "@/lib/services/workflow.service"

async function checkAccess(circleId: string, userId: string, requireAdmin = false) {
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!member) throw new Error("Not a member")
  if (requireAdmin && member.role !== "OWNER" && member.role !== "ADMIN") throw new Error("Forbidden")
  return true
}

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; stepKey?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, stepKey } = await params
  try {
    if (action === "complete" || action === "skip" || action === "reset" || action === "next-cycle") {
      await checkAccess(circleId, s.user.id, true)
    } else {
      await checkAccess(circleId, s.user.id)
    }
    await ensureCircleWorkflow(circleId)
    if (action === "complete" && stepKey) return NextResponse.json({ ok: await completeWorkflowStep(circleId, stepKey, s.user.id) })
    if (action === "skip" && stepKey) return NextResponse.json({ ok: await skipWorkflowStep(circleId, stepKey, s.user.id) })
    if (action === "reset") return NextResponse.json({ ok: await resetWorkflow(circleId, s.user.id) })
    if (action === "next-cycle") return NextResponse.json({ ok: await startNextCycle(circleId, s.user.id) })
    const wf = await ensureCircleWorkflow(circleId)
    const steps = await prisma.circleWorkflowStep.findMany({ where: { workflowId: wf.id }, orderBy: { sortOrder: "asc" } })
    const events = await prisma.circleWorkflowEvent.findMany({ where: { workflowId: wf.id }, orderBy: { createdAt: "desc" }, take: 10 })
    return NextResponse.json({ workflow: wf, steps, events })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}

export const GET = (req: Request, ctx: { params: Promise<{ circleId: string }> }) => handle(req, ctx as any, "get")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; stepKey?: string }> }) => {
  const action = new URL(req.url).pathname.split("/").pop() || ""
  return handle(req, ctx, action)
}
