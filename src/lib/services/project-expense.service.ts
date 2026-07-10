import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

export async function createProjectExpense(projectId: string, circleId: string, userId: string, data: { title: string; description?: string; amount: number; category?: string; vendorName?: string; reference?: string }) {
  return prisma.projectExpense.create({
    data: { projectId, circleId, createdById: userId, title: data.title, description: data.description || null, amount: data.amount, category: (data.category as any) || "OTHER", vendorName: data.vendorName || null, reference: data.reference || null },
  })
}

export async function approveProjectExpense(expenseId: string, adminId: string) {
  const e = await prisma.projectExpense.update({ where: { id: expenseId }, data: { status: "APPROVED", approvedById: adminId, approvedAt: new Date() }, include: { project: { select: { id: true } } } })
  await addProjectActivity(e.project.id, adminId, "expense_approved", `Expense "${e.title}" approved — R${Number(e.amount).toLocaleString()}`)
  return e
}

export async function markProjectExpensePaid(expenseId: string, adminId: string) {
  const e = await prisma.projectExpense.findUnique({ where: { id: expenseId }, include: { project: { select: { id: true, circleId: true } } } })
  if (!e) throw new Error("Not found")
  if (e.status !== "APPROVED") throw new Error("Must be approved first")

  const updated = await prisma.projectExpense.update({ where: { id: expenseId }, data: { status: "PAID", paidById: adminId, paidAt: new Date() } })

  // Ledger entry
  try {
    const wallet = await prisma.wallet.findFirst({ where: { circleId: e.project.circleId, type: "CIRCLE_WALLET" } })
    if (wallet) {
      const expAcc = await prisma.ledgerAccount.findFirst({ where: { walletId: wallet.id, type: "EXPENSES" as any } })
      const adjAcc = await prisma.ledgerAccount.findFirst({ where: { walletId: wallet.id, type: "ADJUSTMENTS" as any } })
      if (expAcc && adjAcc) {
        const key = `project-expense:${expenseId}`
        const existing = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey: key } })
        if (!existing) {
          await prisma.ledgerTransaction.create({
            data: {
              circleId: e.project.circleId, amount: Number(e.amount), type: "EXPENSE", status: "CONFIRMED", idempotencyKey: key,
              entries: { create: [{ accountId: expAcc.id, type: "DEBIT", amount: Number(e.amount), description: `Project expense: ${e.title}` }, { accountId: adjAcc.id, type: "CREDIT", amount: Number(e.amount), description: `Project expense: ${e.title}` }] },
            },
          })
        }
      }
    }
  } catch {}

  await addProjectActivity(e.project.id, adminId, "expense_paid", `Expense "${e.title}" paid — R${Number(e.amount).toLocaleString()}`)
  return updated
}

export async function rejectProjectExpense(expenseId: string, adminId: string, reason?: string) {
  return prisma.projectExpense.update({ where: { id: expenseId }, data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: reason || null } })
}

export async function cancelProjectExpense(expenseId: string) {
  return prisma.projectExpense.update({ where: { id: expenseId }, data: { status: "CANCELLED" } })
}

export async function getProjectExpenseDashboard(projectId: string) {
  const [expenses, project] = await Promise.all([
    prisma.projectExpense.findMany({ where: { projectId }, include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.project.findUnique({ where: { id: projectId }, select: { currentAmount: true } }),
  ])
  const approved = expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID")
  const paid = expenses.filter((e) => e.status === "PAID")
  const pending = expenses.filter((e) => e.status === "PENDING" || e.status === "DRAFT")
  const totalPaid = paid.reduce((s, e) => s + Number(e.amount), 0)
  const totalApproved = approved.reduce((s, e) => s + Number(e.amount), 0)
  const raised = Number(project?.currentAmount || 0)

  const categoryBreakdown: Record<string, number> = {}
  for (const e of paid) { categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + Number(e.amount) }

  return {
    expenses,
    summary: {
      raised, totalApproved, totalPaid,
      totalPending: pending.reduce((s, e) => s + Number(e.amount), 0),
      remainingBudget: raised - totalPaid,
      spendPercentage: raised > 0 ? Math.round((totalPaid / raised) * 100) : 0,
      categoryBreakdown,
    },
    warnings: [] as string[],
  }
}
