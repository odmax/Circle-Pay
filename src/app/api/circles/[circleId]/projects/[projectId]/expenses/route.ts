import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getProjectExpenseDashboard } from "@/lib/services/project-expense.service"

export async function GET(_req: Request, { params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getProjectExpenseDashboard((await params).projectId))
}
