import { NextResponse } from "next/server"
import { getInvestorCtx } from "@/lib/api/project-investor-ctx"
import {
  getProjectUpdate, updateProjectUpdate, deleteProjectUpdate, acknowledgeProjectUpdate,
  addUpdateDiscussion, deleteUpdateDiscussion,
} from "@/lib/services/investor-relations.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; updateId: string }> }) {
  const { circleId, projectId, updateId } = await params
  const ctx = await getInvestorCtx(circleId, projectId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  return NextResponse.json(await getProjectUpdate(updateId, projectId, ctx))
}

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; updateId: string }> }) {
  try {
    const { circleId, projectId, updateId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_UPDATE_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await updateProjectUpdate(projectId, updateId, ctx.userId, body))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; updateId: string }> }) {
  try {
    const { circleId, projectId, updateId } = await params
    const ctx = await getInvestorCtx(circleId, projectId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const allowed = await hasCirclePermission({ userId: ctx.userId, circleId, permission: CIRCLE_PERMISSIONS.INVESTOR_UPDATE_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await deleteProjectUpdate(projectId, updateId, ctx.userId))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; updateId: string }> }) {
  const { circleId, projectId, updateId } = await params
  const ctx = await getInvestorCtx(circleId, projectId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "acknowledge"
  const body = await req.json().catch(() => ({}))

  try {
    if (action === "acknowledge") return NextResponse.json(await acknowledgeProjectUpdate(updateId, ctx.userId))
    if (action === "comment") return NextResponse.json(await addUpdateDiscussion(projectId, updateId, ctx.userId, { kind: "COMMENT", content: body.content }))
    if (action === "question") return NextResponse.json(await addUpdateDiscussion(projectId, updateId, ctx.userId, { kind: "QUESTION", content: body.content }))
    if (action === "reaction") {
      if (!body.reaction) return NextResponse.json({ error: "Reaction required" }, { status: 400 })
      return NextResponse.json(await addUpdateDiscussion(projectId, updateId, ctx.userId, { kind: "REACTION", reaction: body.reaction }))
    }
    if (action === "delete-comment") {
      if (!body.discussionId) return NextResponse.json({ error: "discussionId required" }, { status: 400 })
      return NextResponse.json(await deleteUpdateDiscussion(projectId, updateId, body.discussionId, ctx.userId, ctx.isManager))
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("own") ? 403 : 400 })
  }
}