import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"

export interface CreateBudgetCategoryInput {
  category: string
  description?: string
  approvedBudget: number
  overBudgetPolicy?: string
}

export interface UpdateBudgetCategoryInput {
  description?: string
  approvedBudget?: number
  overBudgetPolicy?: string
}

export async function createBudgetCategory(projectId: string, data: CreateBudgetCategoryInput) {
  const existing = await prisma.projectBudgetCategory.findUnique({
    where: { projectId_category: { projectId, category: data.category } },
  })
  if (existing) throw new Error("Budget category already exists for this project")

  return prisma.projectBudgetCategory.create({
    data: {
      projectId,
      category: data.category,
      description: data.description || null,
      approvedBudget: new Prisma.Decimal(data.approvedBudget),
      overBudgetPolicy: data.overBudgetPolicy || "WARN",
      remainingBudget: new Prisma.Decimal(data.approvedBudget),
    },
  })
}

export async function getBudgetCategories(projectId: string) {
  return prisma.projectBudgetCategory.findMany({
    where: { projectId },
    orderBy: { approvedBudget: "desc" },
  })
}

export async function getBudgetCategoryById(categoryId: string) {
  return prisma.projectBudgetCategory.findUnique({ where: { id: categoryId } })
}

export async function getBudgetCategoryByEnum(projectId: string, category: string) {
  return prisma.projectBudgetCategory.findUnique({
    where: { projectId_category: { projectId, category } },
  })
}

export async function updateBudgetCategory(categoryId: string, data: UpdateBudgetCategoryInput) {
  const existing = await prisma.projectBudgetCategory.findUnique({ where: { id: categoryId } })
  if (!existing) throw new Error("Budget category not found")

  const updateData: Record<string, unknown> = {}
  if (data.description !== undefined) updateData.description = data.description
  if (data.overBudgetPolicy !== undefined) updateData.overBudgetPolicy = data.overBudgetPolicy
  if (data.approvedBudget !== undefined) {
    updateData.approvedBudget = new Prisma.Decimal(data.approvedBudget)
    updateData.remainingBudget = new Prisma.Decimal(data.approvedBudget).minus(existing.actualCost)
    updateData.variance = new Prisma.Decimal(data.approvedBudget).minus(existing.actualCost)
  }

  return prisma.projectBudgetCategory.update({ where: { id: categoryId }, data: updateData })
}

export async function deleteBudgetCategory(categoryId: string) {
  const existing = await prisma.projectBudgetCategory.findUnique({ where: { id: categoryId } })
  if (!existing) throw new Error("Budget category not found")

  const expenseCount = await prisma.projectExpense.count({
    where: { projectId: existing.projectId, category: existing.category as any },
  })
  if (expenseCount > 0) throw new Error("Cannot delete budget category with existing expenses")

  return prisma.projectBudgetCategory.delete({ where: { id: categoryId } })
}

export async function recalculateBudgetCategory(projectId: string, category: string) {
  const budgetCat = await prisma.projectBudgetCategory.findUnique({
    where: { projectId_category: { projectId, category } },
  })
  if (!budgetCat) return null

  const expenses = await prisma.projectExpense.findMany({
    where: {
      projectId,
      category: category as any,
      status: { in: ["APPROVED", "PAID", "PENDING"] },
    },
  })

  const committed = expenses
    .filter((e) => e.status === "PENDING")
    .reduce((s, e) => s + Number(e.amount), 0)
  const actual = expenses
    .filter((e) => e.status === "APPROVED" || e.status === "PAID")
    .reduce((s, e) => s + Number(e.amount), 0)
  const budgeted = Number(budgetCat.approvedBudget)
  const remaining = budgeted - actual - committed
  const variance = budgeted - actual

  let status = "ACTIVE"
  if (actual >= budgeted) status = "OVER_BUDGET"
  else if (actual >= budgeted * 0.9) status = "NEAR_LIMIT"

  return prisma.projectBudgetCategory.update({
    where: { id: budgetCat.id },
    data: {
      committedCost: new Prisma.Decimal(committed),
      actualCost: new Prisma.Decimal(actual),
      remainingBudget: new Prisma.Decimal(Math.max(0, remaining)),
      variance: new Prisma.Decimal(variance),
      status,
    },
  })
}

export async function getBudgetDashboard(projectId: string) {
  const categories = await prisma.projectBudgetCategory.findMany({
    where: { projectId },
    orderBy: { approvedBudget: "desc" },
  })

  const expenses = await prisma.projectExpense.findMany({
    where: { projectId, status: { in: ["APPROVED", "PAID", "PENDING", "DRAFT"] } },
  })

  const totalApprovedBudget = categories.reduce((s, c) => s + Number(c.approvedBudget), 0)
  const totalCommitted = categories.reduce((s, c) => s + Number(c.committedCost), 0)
  const totalSpent = categories.reduce((s, c) => s + Number(c.actualCost), 0)
  const totalRemaining = totalApprovedBudget - totalSpent - totalCommitted
  const totalVariance = totalApprovedBudget - totalSpent
  const overBudgetCategories = categories.filter((c) => c.status === "OVER_BUDGET")
  const pendingApprovals = expenses.filter((e) => e.status === "PENDING" || e.status === "DRAFT")

  const burnPercent = totalApprovedBudget > 0
    ? Math.round((totalSpent / totalApprovedBudget) * 100)
    : 0

  const largestCategories = categories
    .sort((a, b) => Number(b.approvedBudget) - Number(a.approvedBudget))
    .slice(0, 5)
    .map((c) => ({
      category: c.category,
      approved: Number(c.approvedBudget),
      spent: Number(c.actualCost),
      percent: Number(c.approvedBudget) > 0
        ? Math.round((Number(c.actualCost) / Number(c.approvedBudget)) * 100)
        : 0,
    }))

  const warnings: string[] = []
  for (const cat of overBudgetCategories) {
    warnings.push(`${cat.category}: over budget by R${Math.abs(Number(cat.variance)).toLocaleString()}`)
  }

  return {
    categories,
    summary: {
      totalApprovedBudget,
      totalCommitted,
      totalSpent,
      totalRemaining: Math.max(0, totalRemaining),
      totalVariance,
      burnPercent,
      overBudgetCount: overBudgetCategories.length,
      pendingApprovalCount: pendingApprovals.length,
    },
    largestCategories,
    warnings,
  }
}

export async function validateExpenseAgainstBudget(projectId: string, category: string, amount: number) {
  const budgetCat = await prisma.projectBudgetCategory.findUnique({
    where: { projectId_category: { projectId, category } },
  })

  if (!budgetCat) return { allowed: true, warning: null, requiresApproval: false }

  const currentSpent = Number(budgetCat.actualCost)
  const budgeted = Number(budgetCat.approvedBudget)
  const projectedTotal = currentSpent + amount

  if (projectedTotal > budgeted) {
    const overage = projectedTotal - budgeted
    const policy = budgetCat.overBudgetPolicy

    if (policy === "BLOCK") {
      return {
        allowed: false,
        warning: `Expense exceeds budget by R${overage.toLocaleString()}. Over-budget policy is BLOCK.`,
        requiresApproval: false,
      }
    }

    if (policy === "APPROVE") {
      return {
        allowed: true,
        warning: `Expense exceeds budget by R${overage.toLocaleString()}. Requires approval.`,
        requiresApproval: true,
      }
    }

    return {
      allowed: true,
      warning: `Expense exceeds budget by R${overage.toLocaleString()}.`,
      requiresApproval: false,
    }
  }

  if (projectedTotal > budgeted * 0.9) {
    return {
      allowed: true,
      warning: `Approaching budget limit (${Math.round((projectedTotal / budgeted) * 100)}%).`,
      requiresApproval: false,
    }
  }

  return { allowed: true, warning: null, requiresApproval: false }
}
