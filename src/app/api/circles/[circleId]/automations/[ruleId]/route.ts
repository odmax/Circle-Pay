import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureDefaultAutomations, getCircleAutomations, updateAutomationRule, runAutomationRule } from "@/lib/services/automation.service"

async function checkAccess(circleId: string, userId: string, requireAdmin = false) {
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!member) throw new Error("Not a member")
  if (requireAdmin && member.role !== "OWNER" && member.role !== "ADMIN") throw new Error("Forbidden")
}

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; ruleId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, ruleId } = await params
  try {
    await checkAccess(circleId, s.user.id, action !== "get")
    await ensureDefaultAutomations(circleId)
    if (action === "get") return NextResponse.json(await getCircleAutomations(circleId))
    if (action === "toggle" && ruleId) {
      const rule = await prisma.circleAutomationRule.findUnique({ where: { id: ruleId } })
      return NextResponse.json(await updateAutomationRule(ruleId, { isEnabled: !rule?.isEnabled }))
    }
    if (action === "run" && ruleId) return NextResponse.json(await runAutomationRule(ruleId))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}

export const GET = (req: Request, ctx: { params: Promise<{ circleId: string }> }) => handle(req, ctx as any, "get")
export const PATCH = (req: Request, ctx: { params: Promise<{ circleId: string; ruleId: string }> }) => handle(req, ctx as any, "toggle")
export const POST = (req: Request, ctx: { params: Promise<{ circleId: string; ruleId: string }> }) => handle(req, ctx as any, "run")
