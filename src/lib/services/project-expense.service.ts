import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"
import { addProjectActivity } from "@/lib/services/project.service"
import { recalculateBudgetCategory, validateExpenseAgainstBudget } from "@/lib/services/project-budget.service"
import { recordVendorSpend } from "@/lib/services/project-vendor.service"

export interface CreateExpenseInput {
  title: string
  description?: string
  amount: number
  category?: string
  vendorId?: string
  vendorName?: string
  vendorContact?: string
  reference?: string
  paymentMethod?: string
  expenseDate?: Date
  notes?: string
}

export interface UpdateExpenseInput {
  title?: string
  description?: string
  amount?: number
  category?: string
  vendorId?: string
  vendorName?: string
  vendorContact?: string
  reference?: string
  paymentMethod?: string
  expenseDate?: Date
  notes?: string
}

export async function createExpense(
  projectId: string,
  circleId: string,
  userId: string,
  data: CreateExpenseInput,
) {
  const budgetValidation = await validateExpenseAgainstBudget(
    projectId,
    data.category || "OTHER",
    data.amount,
  )

  const expense = await prisma.projectExpense.create({
    data: {
      projectId,
      circleId,
      createdById: userId,
      title: data.title,
      description: data.description || null,
      amount: new Prisma.Decimal(data.amount),
      category: (data.category as any) || "OTHER",
      vendorId: data.vendorId || null,
      vendorName: data.vendorName || null,
      vendorContact: data.vendorContact || null,
      reference: data.reference || null,
      paymentMethod: data.paymentMethod || null,
      expenseDate: data.expenseDate || new Date(),
      notes: data.notes || null,
      status: budgetValidation.requiresApproval ? "PENDING" : "DRAFT",
    },
  })

  if (data.vendorId) {
    await recordVendorSpend(data.vendorId, data.amount).catch(() => {})
  }

  await recalculateBudgetCategory(projectId, data.category || "OTHER").catch(() => {})

  await addProjectActivity(
    projectId,
    userId,
    "expense_created",
    `Expense "${data.title}" created — R${data.amount.toLocaleString()}`,
  ).catch(() => {})

  return { expense, budgetValidation }
}

export async function updateExpense(expenseId: string, userId: string, data: UpdateExpenseInput) {
  const existing = await prisma.projectExpense.findUnique({ where: { id: expenseId } })
  if (!existing) throw new Error("Expense not found")
  if (!["DRAFT", "REJECTED"].includes(existing.status)) {
    throw new Error("Only draft or rejected expenses can be edited")
  }

  const oldCategory = existing.category
  const oldAmount = Number(existing.amount)
  const newCategory = data.category || oldCategory
  const newAmount = data.amount !== undefined ? data.amount : oldAmount

  const expense = await prisma.projectExpense.update({
    where: { id: expenseId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount !== undefined && { amount: new Prisma.Decimal(data.amount) }),
      ...(data.category !== undefined && { category: data.category as any }),
      ...(data.vendorId !== undefined && { vendorId: data.vendorId }),
      ...(data.vendorName !== undefined && { vendorName: data.vendorName }),
      ...(data.vendorContact !== undefined && { vendorContact: data.vendorContact }),
      ...(data.reference !== undefined && { reference: data.reference }),
      ...(data.paymentMethod !== undefined && { paymentMethod: data.paymentMethod }),
      ...(data.expenseDate !== undefined && { expenseDate: data.expenseDate }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  })

  if (oldCategory !== newCategory) {
    await recalculateBudgetCategory(existing.projectId, oldCategory).catch(() => {})
  }
  await recalculateBudgetCategory(existing.projectId, newCategory).catch(() => {})

  await addProjectActivity(
    existing.projectId,
    userId,
    "expense_updated",
    `Expense "${expense.title}" updated`,
  ).catch(() => {})

  return expense
}

export async function deleteExpense(expenseId: string, userId: string) {
  const existing = await prisma.projectExpense.findUnique({ where: { id: expenseId } })
  if (!existing) throw new Error("Expense not found")
  if (existing.status !== "DRAFT") throw new Error("Only draft expenses can be deleted")

  await prisma.projectExpense.delete({ where: { id: expenseId } })
  await recalculateBudgetCategory(existing.projectId, existing.category).catch(() => {})

  await addProjectActivity(
    existing.projectId,
    userId,
    "expense_deleted",
    `Expense "${existing.title}" deleted`,
  ).catch(() => {})

  return existing
}

export async function submitExpense(expenseId: string, userId: string) {
  const existing = await prisma.projectExpense.findUnique({ where: { id: expenseId } })
  if (!existing) throw new Error("Expense not found")
  if (existing.status !== "DRAFT") throw new Error("Only draft expenses can be submitted")

  const expense = await prisma.projectExpense.update({
    where: { id: expenseId },
    data: { status: "PENDING" },
  })

  await addProjectActivity(
    existing.projectId,
    userId,
    "expense_submitted",
    `Expense "${existing.title}" submitted for approval`,
  ).catch(() => {})

  return expense
}

export async function approveExpense(expenseId: string, adminId: string) {
  const expense = await prisma.projectExpense.update({
    where: { id: expenseId },
    data: { status: "APPROVED", approvedById: adminId, approvedAt: new Date() },
    include: { project: { select: { id: true } } },
  })

  await recalculateBudgetCategory(expense.projectId, expense.category).catch(() => {})

  await addProjectActivity(
    expense.projectId,
    adminId,
    "expense_approved",
    `Expense "${expense.title}" approved — R${Number(expense.amount).toLocaleString()}`,
  ).catch(() => {})

  return expense
}

export async function rejectExpense(expenseId: string, adminId: string, reason?: string) {
  const expense = await prisma.projectExpense.update({
    where: { id: expenseId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedReason: reason || null,
    },
    include: { project: { select: { id: true } } },
  })

  await recalculateBudgetCategory(expense.projectId, expense.category).catch(() => {})

  await addProjectActivity(
    expense.projectId,
    adminId,
    "expense_rejected",
    `Expense "${expense.title}" rejected${reason ? `: ${reason}` : ""}`,
  ).catch(() => {})

  return expense
}

export async function markExpensePaid(expenseId: string, adminId: string) {
  const existing = await prisma.projectExpense.findUnique({
    where: { id: expenseId },
    include: { project: { select: { id: true, circleId: true } } },
  })
  if (!existing) throw new Error("Not found")
  if (existing.status !== "APPROVED") throw new Error("Must be approved first")

  const updated = await prisma.projectExpense.update({
    where: { id: expenseId },
    data: { status: "PAID", paidById: adminId, paidAt: new Date() },
  })

  try {
    const wallet = await prisma.wallet.findFirst({
      where: { circleId: existing.project.circleId, type: "CIRCLE_WALLET" },
    })
    if (wallet) {
      const expAcc = await prisma.ledgerAccount.findFirst({
        where: { walletId: wallet.id, type: "EXPENSES" as any },
      })
      const adjAcc = await prisma.ledgerAccount.findFirst({
        where: { walletId: wallet.id, type: "ADJUSTMENTS" as any },
      })
      if (expAcc && adjAcc) {
        const key = `project-expense:${expenseId}`
        const txExisting = await prisma.ledgerTransaction.findUnique({
          where: { idempotencyKey: key },
        })
        if (!txExisting) {
          await prisma.ledgerTransaction.create({
            data: {
              circleId: existing.project.circleId,
              amount: Number(existing.amount),
              type: "EXPENSE",
              status: "CONFIRMED",
              idempotencyKey: key,
              entries: {
                create: [
                  {
                    accountId: expAcc.id,
                    type: "DEBIT",
                    amount: Number(existing.amount),
                    description: `Project expense: ${existing.title}`,
                  },
                  {
                    accountId: adjAcc.id,
                    type: "CREDIT",
                    amount: Number(existing.amount),
                    description: `Project expense: ${existing.title}`,
                  },
                ],
              },
            },
          })
        }
      }
    }
  } catch {}

  await addProjectActivity(
    existing.project.id,
    adminId,
    "expense_paid",
    `Expense "${existing.title}" paid — R${Number(existing.amount).toLocaleString()}`,
  ).catch(() => {})

  return updated
}

export async function voidExpense(expenseId: string, userId: string, reason: string) {
  const existing = await prisma.projectExpense.findUnique({ where: { id: expenseId } })
  if (!existing) throw new Error("Expense not found")
  if (existing.status !== "APPROVED" && existing.status !== "PAID") {
    throw new Error("Only approved or paid expenses can be voided")
  }
  if (!reason) throw new Error("Void reason is required")

  const expense = await prisma.projectExpense.update({
    where: { id: expenseId },
    data: {
      status: "VOIDED",
      voidedById: userId,
      voidedAt: new Date(),
      voidReason: reason,
    },
  })

  if (existing.status === "PAID") {
    try {
      const wallet = await prisma.wallet.findFirst({
        where: { circleId: existing.circleId, type: "CIRCLE_WALLET" },
      })
      if (wallet) {
        const expAcc = await prisma.ledgerAccount.findFirst({
          where: { walletId: wallet.id, type: "EXPENSES" as any },
        })
        const adjAcc = await prisma.ledgerAccount.findFirst({
          where: { walletId: wallet.id, type: "ADJUSTMENTS" as any },
        })
        if (expAcc && adjAcc) {
          const key = `project-expense-void:${expenseId}`
          const txExisting = await prisma.ledgerTransaction.findUnique({
            where: { idempotencyKey: key },
          })
          if (!txExisting) {
            await prisma.ledgerTransaction.create({
              data: {
                circleId: existing.circleId,
                amount: Number(existing.amount),
                type: "EXPENSE",
                status: "CONFIRMED",
                idempotencyKey: key,
                entries: {
                  create: [
                    {
                      accountId: adjAcc.id,
                      type: "DEBIT",
                      amount: Number(existing.amount),
                      description: `Expense void reversal: ${existing.title}`,
                    },
                    {
                      accountId: expAcc.id,
                      type: "CREDIT",
                      amount: Number(existing.amount),
                      description: `Expense void reversal: ${existing.title}`,
                    },
                  ],
                },
              },
            })
          }
        }
      }
    } catch {}
  }

  await recalculateBudgetCategory(existing.projectId, existing.category).catch(() => {})

  await addProjectActivity(
    existing.projectId,
    userId,
    "expense_voided",
    `Expense "${existing.title}" voided: ${reason}`,
  ).catch(() => {})

  return expense
}

export async function correctExpense(expenseId: string, userId: string, data: CreateExpenseInput) {
  const existing = await prisma.projectExpense.findUnique({ where: { id: expenseId } })
  if (!existing) throw new Error("Expense not found")
  if (existing.status !== "APPROVED" && existing.status !== "PAID") {
    throw new Error("Only approved or paid expenses can be corrected")
  }

  const corrected = await prisma.projectExpense.update({
    where: { id: expenseId },
    data: { status: "CORRECTED", correctedFromId: expenseId },
  })

  const newExpense = await prisma.projectExpense.create({
    data: {
      projectId: existing.projectId,
      circleId: existing.circleId,
      createdById: userId,
      correctedFromId: expenseId,
      title: data.title || existing.title,
      description: data.description || existing.description,
      amount: new Prisma.Decimal(data.amount),
      category: (data.category as any) || existing.category,
      vendorId: data.vendorId || existing.vendorId,
      vendorName: data.vendorName || existing.vendorName,
      vendorContact: data.vendorContact || existing.vendorContact,
      reference: data.reference || existing.reference,
      paymentMethod: data.paymentMethod || existing.paymentMethod,
      expenseDate: data.expenseDate || existing.expenseDate,
      notes: data.notes || existing.notes,
      status: "DRAFT",
    },
  })

  await recalculateBudgetCategory(existing.projectId, existing.category).catch(() => {})

  await addProjectActivity(
    existing.projectId,
    userId,
    "expense_corrected",
    `Expense "${existing.title}" corrected — new expense created`,
  ).catch(() => {})

  return { corrected, newExpense }
}

export async function duplicateExpense(expenseId: string, userId: string) {
  const existing = await prisma.projectExpense.findUnique({ where: { id: expenseId } })
  if (!existing) throw new Error("Expense not found")

  const duplicate = await prisma.projectExpense.create({
    data: {
      projectId: existing.projectId,
      circleId: existing.circleId,
      createdById: userId,
      title: `${existing.title} (copy)`,
      description: existing.description,
      amount: existing.amount,
      category: existing.category,
      vendorId: existing.vendorId,
      vendorName: existing.vendorName,
      vendorContact: existing.vendorContact,
      reference: existing.reference,
      paymentMethod: existing.paymentMethod,
      notes: existing.notes,
      status: "DRAFT",
    },
  })

  await addProjectActivity(
    existing.projectId,
    userId,
    "expense_duplicated",
    `Expense "${existing.title}" duplicated`,
  ).catch(() => {})

  return duplicate
}

export async function getExpenseById(expenseId: string) {
  return prisma.projectExpense.findUnique({
    where: { id: expenseId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      paidBy: { select: { id: true, name: true } },
      voidedBy: { select: { id: true, name: true } },
      vendor: true,
      project: { select: { id: true, name: true, circleId: true } },
    },
  })
}

export async function getExpenseDashboard(projectId: string) {
  const [expenses, project, budgetDashboard] = await Promise.all([
    prisma.projectExpense.findMany({
      where: { projectId },
      include: {
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { currentAmount: true, targetAmount: true },
    }),
    prisma.projectBudgetCategory.findMany({ where: { projectId } }),
  ])

  const approved = expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID")
  const paid = expenses.filter((e) => e.status === "PAID")
  const pending = expenses.filter((e) => e.status === "PENDING")
  const drafts = expenses.filter((e) => e.status === "DRAFT")
  const totalPaid = paid.reduce((s, e) => s + Number(e.amount), 0)
  const totalApproved = approved.reduce((s, e) => s + Number(e.amount), 0)
  const totalPending = pending.reduce((s, e) => s + Number(e.amount), 0)
  const raised = Number(project?.currentAmount || 0)

  const categoryBreakdown: Record<string, number> = {}
  for (const e of paid) {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + Number(e.amount)
  }

  const budgetByCategory: Record<string, { budgeted: number; spent: number; variance: number }> = {}
  for (const cat of budgetDashboard) {
    budgetByCategory[cat.category] = {
      budgeted: Number(cat.approvedBudget),
      spent: Number(cat.actualCost),
      variance: Number(cat.variance),
    }
  }
  for (const e of expenses) {
    if (!budgetByCategory[e.category]) {
      budgetByCategory[e.category] = { budgeted: 0, spent: 0, variance: 0 }
    }
    if (e.status === "PAID" || e.status === "APPROVED") {
      budgetByCategory[e.category].spent += Number(e.amount)
    }
  }

  const warnings: string[] = []
  for (const [cat, data] of Object.entries(budgetByCategory)) {
    if (data.budgeted > 0 && data.spent > data.budgeted) {
      warnings.push(`${cat}: over budget by R${(data.spent - data.budgeted).toLocaleString()}`)
    }
  }

  return {
    expenses,
    summary: {
      raised,
      totalApproved,
      totalPaid,
      totalPending,
      totalDrafts: drafts.reduce((s, e) => s + Number(e.amount), 0),
      remainingBudget: raised - totalPaid,
      spendPercentage: raised > 0 ? Math.round((totalPaid / raised) * 100) : 0,
      categoryBreakdown,
      budgetByCategory,
    },
    warnings,
  }
}
