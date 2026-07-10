import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function csvResponse(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n")
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=${filename}` } })
}

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { hasFeature } = await import("@/lib/services/feature-gate.service")
  if (!await hasFeature(s.user.id, "REPORTS")) return NextResponse.json({ error: "Reports require a paid plan" }, { status: 403 })
  const { circleId } = await params
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
  if (!m) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const type = new URL(req.url).searchParams.get("type")

  if (type === "contributions") {
    const items = await prisma.contribution.findMany({ where: { circleId, deletedAt: null }, include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } }, orderBy: { paymentDate: "desc" } })
    return csvResponse(["Date", "Member", "Email", "Amount", "Plan", "Status", "Note"], items.map((i) => [i.paymentDate.toISOString().split("T")[0], i.user.name || "", i.user.email, Number(i.amount).toFixed(2), i.plan?.name || "", i.status, i.note || ""]), "contributions.csv")
  }
  if (type === "expenses") {
    const items = await prisma.expense.findMany({ where: { circleId, deletedAt: null }, include: { paidBy: { select: { name: true, email: true } } }, orderBy: { expenseDate: "desc" } })
    return csvResponse(["Date", "Title", "Paid By", "Email", "Amount", "Category", "Split Type"], items.map((i) => [i.expenseDate.toISOString().split("T")[0], i.title, i.paidBy.name || "", i.paidBy.email || "", Number(i.amount).toFixed(2), i.category, i.splitType]), "expenses.csv")
  }
  if (type === "balances") {
    const items = await prisma.balance.findMany({ where: { circleId, amount: { gt: 0 } }, include: { debtor: { select: { name: true, email: true } }, creditor: { select: { name: true, email: true } } } })
    return csvResponse(["Debtor", "Debtor Email", "Creditor", "Creditor Email", "Amount"], items.map((i) => [i.debtor.name || "", i.debtor.email, i.creditor.name || "", i.creditor.email, Number(i.amount).toFixed(2)]), "balances.csv")
  }
  if (type === "members") {
    const items = await prisma.circleMember.findMany({ where: { circleId }, include: { user: { select: { name: true, email: true, phone: true } } } })
    return csvResponse(["Name", "Email", "Phone", "Role", "Joined"], items.map((i) => [i.user.name || "", i.user.email, i.user.phone || "", i.role, i.joinedAt.toISOString().split("T")[0]]), "members.csv")
  }
  return NextResponse.json({ error: "Unknown type" }, { status: 404 })
}
