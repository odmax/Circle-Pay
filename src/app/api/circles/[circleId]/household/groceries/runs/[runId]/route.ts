import { NextResponse } from "next/server"
import { getHouseholdCtx } from "@/lib/api/household-ctx"
import { addGroceryItem, updateGroceryItem, transitionGroceryRun } from "@/lib/services/household-purchase.service"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; runId: string }> }) {
  try {
    const { circleId, runId } = await params
    const ctx = await getHouseholdCtx(circleId)
    if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
    const run = await prisma.householdGroceryRun.findFirst({ where: { id: runId, circleId } })
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!ctx.isManager && run.assignedShopperId !== ctx.userId && run.createdById !== ctx.userId) {
      return NextResponse.json({ error: "Only the shopper, creator or a manager can edit a run" }, { status: 403 })
    }
    const body = await req.json()
    const safe: Record<string, unknown> = {}
    for (const k of ["title", "assignedShopperId", "expectedBudget", "scheduledFor", "notes"]) if (body[k] !== undefined) safe[k] = body[k]
    if (safe.scheduledFor === "" || safe.scheduledFor === null) safe.scheduledFor = null
    else if (safe.scheduledFor) safe.scheduledFor = new Date(String(safe.scheduledFor))
    if (safe.expectedBudget != null) safe.expectedBudget = Number(safe.expectedBudget)
    const updated = await prisma.householdGroceryRun.update({ where: { id: runId }, data: safe as Record<string, unknown> } as any)
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; runId: string }> }) {
  const { circleId, runId } = await params
  const ctx = await getHouseholdCtx(circleId)
  if (!ctx) return NextResponse.json({ error: "Unauthorized or not found" }, { status: 404 })
  const url = new URL(req.url)
  const action = url.searchParams.get("action") || "status"
  const body = await req.json().catch(() => ({}))

  try {
    if (action === "add-item") {
      return NextResponse.json(await addGroceryItem(circleId, runId, ctx.userId, body), { status: 201 })
    }
    if (action === "update-item") {
      if (!body.itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 })
      return NextResponse.json(await updateGroceryItem(circleId, runId, body.itemId, ctx.userId, body))
    }
    // status transition: manager, assigned shopper or run creator
    const run = await prisma.householdGroceryRun.findFirst({ where: { id: runId, circleId } })
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!ctx.isManager && run.assignedShopperId !== ctx.userId && run.createdById !== ctx.userId) {
      return NextResponse.json({ error: "Only the shopper, creator or a manager can change run status" }, { status: 403 })
    }
    if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 })
    return NextResponse.json(await transitionGroceryRun(circleId, runId, ctx.userId, body.status))
  } catch (e) {
    const message = (e as Error).message
    return NextResponse.json({ error: message }, { status: message.includes("only") || message.includes("shopper") ? 403 : 400 })
  }
}