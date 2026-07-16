import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createProjectAsset, markAssetSold, getProjectROIDashboard } from "@/lib/services/project-roi.service"
import { requireProjectInCircle } from "@/lib/services/project.service"

async function checkAdmin(circleId: string, userId: string) { const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } }); if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) throw new Error("Forbidden") }

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; assetId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId, assetId } = await params
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  try {
    if (action === "get") return NextResponse.json(await getProjectROIDashboard(projectId))
    await checkAdmin(circleId, s.user.id)
    if (action === "create") return NextResponse.json(await createProjectAsset(projectId, circleId, s.user.id, await req.json()), { status: 201 })
    if (!assetId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    if (action === "sold") { const { saleValue } = await req.json(); return NextResponse.json(await markAssetSold(assetId, s.user.id, saleValue)) }
    return NextResponse.json({ error: "Unknown" }, { status: 400 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}
export const GET = (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string }> }) => handle(req, ctx as any, "get")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; projectId: string; assetId?: string }> }) => handle(req, ctx, new URL(req.url).pathname.endsWith("/sold") ? "sold" : "create")
