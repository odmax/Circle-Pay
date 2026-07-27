import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireProjectInCircle } from "@/lib/services/project.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { generateFinancialStatement, getProjectFinancialStatements } from "@/lib/services/project-financial-statement.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.CIRCLE_VIEW })
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)
  return NextResponse.json(await getProjectFinancialStatements(projectId))
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  try {
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_MANAGE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const body = await req.json()
    return NextResponse.json(await generateFinancialStatement(projectId, circleId, s.user.id, body), { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
