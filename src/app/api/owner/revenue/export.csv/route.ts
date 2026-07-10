import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { requireOwnerPermission: check } = await import("@/lib/services/owner-permission.service")
    await check(s.user.id, "REVENUE_EXPORT")
  } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  const url = new URL(req.url)
  const where: Record<string, unknown> = { status: "PAID" }
  if (url.searchParams.get("planId")) where.planId = url.searchParams.get("planId")
  if (url.searchParams.get("provider")) where.provider = url.searchParams.get("provider")
  if (url.searchParams.get("startDate") || url.searchParams.get("endDate")) {
    where.paidAt = {}
    if (url.searchParams.get("startDate")) (where.paidAt as any).gte = new Date(url.searchParams.get("startDate")!)
    if (url.searchParams.get("endDate")) (where.paidAt as any).lte = new Date(url.searchParams.get("endDate")!)
  }

  const payments = await prisma.paymentTransaction.findMany({
    where, include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } },
    orderBy: { paidAt: "desc" },
  })

  const headers = ["Date", "User", "Email", "Plan", "Amount", "Currency", "Provider", "Reference"]
  const rows = payments.map((p) => [
    (p.paidAt || p.createdAt).toISOString().split("T")[0],
    p.user?.name || "", p.user?.email || "", p.plan.name,
    Number(p.amount).toFixed(2), p.currency, p.provider, p.merchantReference,
  ])
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n")
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=revenue.csv" } })
}
