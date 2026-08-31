import { NextResponse } from "next/server"
import { getInvestorCtx } from "@/lib/api/project-investor-ctx"
import { listInvestorQuestions, createInvestorQuestion } from "@/lib/services/investor-relations.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = await params
  const ctx = await getInvestorCtx(circleId, projectId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  return NextResponse.json({ questions: await listInvestorQuestions(projectId, circleId, ctx) })
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  try {
    const { circleId, projectId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const body = await req.json()
    const q = await createInvestorQuestion(projectId, circleId, ctx.userId, { question: body.question, visibility: body.visibility })
    return NextResponse.json(q, { status: 201 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("invested") ? 403 : 400 })
  }
}