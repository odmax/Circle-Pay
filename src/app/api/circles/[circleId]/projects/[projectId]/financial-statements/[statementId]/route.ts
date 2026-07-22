import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { approveFinancialStatement } from "@/lib/services/project-financial-statement.service"

export async function PATCH(req: Request, { params }: { params: Promise<{ circleId: string; projectId: string; statementId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, statementId } = await params
  try {
    const allowed = await hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_APPROVE })
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await approveFinancialStatement(statementId, s.user.id))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
