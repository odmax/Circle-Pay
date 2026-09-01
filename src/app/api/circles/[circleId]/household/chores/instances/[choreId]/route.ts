import { NextRequest, NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { completeChore, skipChore, reassignChore, requestChoreSwap } from "@/lib/services/household-chores.service"
import { validateProofFile, uploadProofImage } from "@/lib/services/upload.service"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; choreId: string }> },
) {
  const { circleId, choreId } = await params
  const ctx = await getHouseholdCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "complete"

  try {
    if (action === "complete") {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      const note = (formData.get("note") as string) || undefined
      let proofUrl: string | undefined
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer())
        validateProofFile({ size: file.size, type: file.type, name: file.name })
        const result = await uploadProofImage(buffer, file.name, ctx.userId, circleId)
        proofUrl = result.proofUrl
      }
      return NextResponse.json(await completeChore(circleId, choreId, ctx.userId, ctx.isManager, { note, proofUrl }), { status: 201 })
    }
    if (action === "skip") {
      return NextResponse.json(await skipChore(circleId, choreId, ctx.userId, ctx.isManager))
    }
    if (action === "assign") {
      if (!ctx.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const body = await req.json()
      if (!body.assigneeId) return NextResponse.json({ error: "assigneeId required" }, { status: 400 })
      return NextResponse.json(await reassignChore(circleId, choreId, ctx.userId, body.assigneeId))
    }
    if (action === "swap-request") {
      const body = await req.json()
      return NextResponse.json(await requestChoreSwap(circleId, choreId, ctx.userId, body.toUserId, ctx.isManager, body.note), { status: 201 })
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("you") ? 403 : 400 })
  }
}