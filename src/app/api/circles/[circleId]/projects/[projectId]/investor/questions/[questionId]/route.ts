import { NextResponse } from "next/server"
import { getInvestorCtx } from "@/lib/api/project-investor-ctx"
import { answerInvestorQuestion, resolveInvestorQuestion, editOwnInvestorQuestion } from "@/lib/services/investor-relations.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; questionId: string }> }) {
  try {
    const { circleId, projectId, questionId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const body = await req.json()
    // Members can edit their own open question only.
    const q = await editOwnInvestorQuestion(projectId, questionId, ctx.userId, { question: body.question })
    return NextResponse.json(q)
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("own") ? 403 : 400 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; questionId: string }> }) {
  const { circleId, projectId, questionId } = await params
  const ctx = await getInvestorCtx(circleId, projectId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "answer"
  const body = await req.json().catch(() => ({}))
  const canAnswer = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_QUESTION_ANSWER })
  if (!canAnswer) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    if (action === "answer") {
      if (!body.answer) return NextResponse.json({ error: "Answer is required" }, { status: 400 })
      return NextResponse.json(await answerInvestorQuestion(projectId, questionId, circleId, ctx.userId, { answer: body.answer, publishToInvestors: body.publishToInvestors }))
    }
    if (action === "resolve") return NextResponse.json(await resolveInvestorQuestion(projectId, questionId, circleId, ctx.userId))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}