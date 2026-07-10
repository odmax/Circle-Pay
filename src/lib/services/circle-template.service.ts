import { prisma } from "@/lib/prisma"
import type { ContributionFrequency, CircleWidgetType } from "@/generated/prisma"
import { ensureCircleWallet } from "@/lib/services/wallet.service"

async function log(circleId: string, type: string, action: string, status: "SUCCESS" | "FAILED" | "SKIPPED", message: string) {
  try {
    await prisma.circleAutomationLog.create({ data: { circleId, type, action, status, message } })
  } catch {}
}

async function createWidget(circleId: string, data: { type: string; title: string; description?: string; sortOrder?: number }) {
  try {
    await prisma.circleWidget.create({ data: { circleId, type: data.type as CircleWidgetType, title: data.title, description: data.description, sortOrder: data.sortOrder || 0 } })
  } catch {}
}

async function createExpenseCategories(circleId: string, names: string[]) {
  for (const name of names) {
    try {
      await prisma.expenseCategory.create({ data: { circleId, name, isDefault: true } })
    } catch {}
  }
}

export async function applyCircleTemplate(circleId: string, userId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId } })
  if (!circle) return

  // Auto-create wallet (idempotent)
  ensureCircleWallet(circleId).catch(console.error)

  const settings = (circle.settings as Record<string, unknown> | null) || {}
  const type = circle.type

  const handlers: Record<string, (circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) => Promise<void>> = {
    STOKVEL: applyStokvelTemplate,
    HOUSEMATE: applyHousemateTemplate,
    TRAVEL: applyTravelTemplate,
    WEDDING: applyWeddingTemplate,
    SAVINGS: applySavingsTemplate,
    FAMILY: applyFamilyTemplate,
    CHURCH: applyChurchTemplate,
    INVESTMENT: applyInvestmentTemplate,
    CUSTOM: applyCustomTemplate,
  }

  const handler = handlers[type]
  if (handler) await handler(circle, userId, settings)
}

export async function applyStokvelTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  const amt = Number(settings.contributionAmount) || 500
  const freq = (settings.contributionFrequency as string) || "monthly"
  const duration = Number(settings.duration) || 12

  try {
    await prisma.contributionPlan.create({
      data: { circleId: circle.id, name: "Stokvel Contribution", amount: amt, frequency: (freq === "weekly" ? "WEEKLY" : "MONTHLY") as ContributionFrequency, dueDay: 1, startDate: new Date(), createdById: userId },
    })
    log(circle.id, "STOKVEL", "create", "SUCCESS", "Contribution plan created")
  } catch (e) { log(circle.id, "STOKVEL", "create", "FAILED", `Contribution plan failed: ${e}`) }

  try {
    await prisma.goal.create({ data: { circleId: circle.id, name: "Stokvel Pool", targetAmount: amt * duration, createdById: userId } })
    log(circle.id, "STOKVEL", "create", "SUCCESS", "Stokvel pool goal created")
  } catch (e) { log(circle.id, "STOKVEL", "create", "FAILED", `Goal failed: ${e}`) }

  await createWidget(circle.id, { type: "CONTRIBUTION_SUMMARY", title: "Contributions", description: "Track stokvel payments", sortOrder: 1 })
  await createWidget(circle.id, { type: "GOAL_PROGRESS", title: "Stokvel Pool", description: "Total pool progress", sortOrder: 2 })
  await createWidget(circle.id, { type: "PAYOUT_TRACKER", title: "Payout Schedule", description: "Upcoming payouts", sortOrder: 3 })
}

export async function applyHousemateTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  const rent = Number(settings.rentAmount) || 0
  if (rent > 0) {
    try {
      await prisma.contributionPlan.create({ data: { circleId: circle.id, name: "Monthly Rent", amount: rent, frequency: "MONTHLY" as ContributionFrequency, dueDay: Number(settings.rentDueDay) || 1, startDate: new Date(), createdById: userId } })
      log(circle.id, "HOUSEMATE", "create", "SUCCESS", "Rent plan created")
    } catch (e) { log(circle.id, "HOUSEMATE", "create", "FAILED", `Rent plan: ${e}`) }
  }

  try {
    await prisma.goal.create({ data: { circleId: circle.id, name: "Household Buffer", targetAmount: rent * 2 || 5000, createdById: userId } })
    log(circle.id, "HOUSEMATE", "create", "SUCCESS", "Buffer goal created")
  } catch (e) { log(circle.id, "HOUSEMATE", "create", "FAILED", `Goal: ${e}`) }

  await createExpenseCategories(circle.id, ["Rent", "Utilities", "Groceries", "Internet", "Cleaning"])
  await createWidget(circle.id, { type: "RENT_DUE", title: "Rent Due", description: "Upcoming rent", sortOrder: 1 })
  await createWidget(circle.id, { type: "EXPENSE_SUMMARY", title: "Expenses", description: "Shared expenses", sortOrder: 2 })
  await createWidget(circle.id, { type: "BALANCE_SUMMARY", title: "Balances", description: "Who owes who", sortOrder: 3 })
}

export async function applyTravelTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  const dest = (settings.destination as string) || "Trip"
  const budget = Number(settings.budgetPerPerson) || 5000

  try {
    await prisma.goal.create({ data: { circleId: circle.id, name: `${dest} Trip Fund`, targetAmount: budget, createdById: userId } })
    log(circle.id, "TRAVEL", "create", "SUCCESS", "Trip goal created")
  } catch (e) { log(circle.id, "TRAVEL", "create", "FAILED", `Goal: ${e}`) }

  await createExpenseCategories(circle.id, ["Transport", "Accommodation", "Food", "Activities", "Emergency"])
  await createWidget(circle.id, { type: "BUDGET_TRACKER", title: `${dest} Budget`, description: "Trip budget tracker", sortOrder: 1 })
  await createWidget(circle.id, { type: "COUNTDOWN", title: "Countdown", description: "Days to departure", sortOrder: 2 })
  await createWidget(circle.id, { type: "EXPENSE_SUMMARY", title: "Expenses", description: "Trip expenses", sortOrder: 3 })
}

export async function applyWeddingTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  const total = Number(settings.totalBudget) || 50000
  try {
    await prisma.goal.create({ data: { circleId: circle.id, name: "Wedding Fund", targetAmount: total, createdById: userId } })
    log(circle.id, "WEDDING", "create", "SUCCESS", "Wedding fund goal created")
  } catch (e) { log(circle.id, "WEDDING", "create", "FAILED", `Goal: ${e}`) }

  await createExpenseCategories(circle.id, ["Venue", "Catering", "Outfits", "Decor", "Photography", "Music"])
  await createWidget(circle.id, { type: "GOAL_PROGRESS", title: "Wedding Fund", description: "Budget progress", sortOrder: 1 })
  await createWidget(circle.id, { type: "EXPENSE_SUMMARY", title: "Expenses", description: "Wedding expenses", sortOrder: 2 })
  await createWidget(circle.id, { type: "BUDGET_TRACKER", title: "Budget Tracker", description: "Stay on track", sortOrder: 3 })
}

export async function applySavingsTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  const target = Number(settings.targetAmount) || 10000
  const saving = Number(settings.savingAmount) || 1000
  const freq = (settings.savingFrequency as string) || "monthly"

  try {
    await prisma.contributionPlan.create({ data: { circleId: circle.id, name: "Monthly Savings", amount: saving, frequency: (freq === "weekly" ? "WEEKLY" : "MONTHLY") as ContributionFrequency, dueDay: 1, startDate: new Date(), createdById: userId } })
    log(circle.id, "SAVINGS", "create", "SUCCESS", "Savings plan created")
  } catch (e) { log(circle.id, "SAVINGS", "create", "FAILED", `Plan: ${e}`) }

  try {
    await prisma.goal.create({ data: { circleId: circle.id, name: "Savings Goal", targetAmount: target, deadline: settings.goalDeadline ? new Date(settings.goalDeadline as string) : null, createdById: userId } })
    log(circle.id, "SAVINGS", "create", "SUCCESS", "Savings goal created")
  } catch (e) { log(circle.id, "SAVINGS", "create", "FAILED", `Goal: ${e}`) }

  await createWidget(circle.id, { type: "SAVINGS_FORECAST", title: "Savings Forecast", description: "Projected savings", sortOrder: 1 })
  await createWidget(circle.id, { type: "GOAL_PROGRESS", title: "Goal Progress", description: "Savings goal", sortOrder: 2 })
}

export async function applyFamilyTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  const amt = Number(settings.contributionAmount) || 2000
  try {
    await prisma.contributionPlan.create({ data: { circleId: circle.id, name: "Family Contribution", amount: amt, frequency: "MONTHLY" as ContributionFrequency, dueDay: 1, startDate: new Date(), createdById: userId } })
    log(circle.id, "FAMILY", "create", "SUCCESS", "Family contribution plan created")
  } catch (e) { log(circle.id, "FAMILY", "create", "FAILED", `Plan: ${e}`) }

  try { await prisma.goal.create({ data: { circleId: circle.id, name: "Family Fund", targetAmount: amt * 6, createdById: userId } }) } catch {}
  if (settings.emergencyFund) { try { await prisma.goal.create({ data: { circleId: circle.id, name: "Emergency Fund", targetAmount: amt * 3, createdById: userId } }) } catch {} }

  await createExpenseCategories(circle.id, ["Groceries", "School", "Medical", "Transport", "Support"])
  await createWidget(circle.id, { type: "CONTRIBUTION_SUMMARY", title: "Family Fund", description: "Contributions", sortOrder: 1 })
  await createWidget(circle.id, { type: "EXPENSE_SUMMARY", title: "Expenses", description: "Family expenses", sortOrder: 2 })
}

export async function applyChurchTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  const goal = Number(settings.fundraisingGoal) || 50000
  const project = (settings.projectName as string) || "Building Fund"
  try {
    await prisma.goal.create({ data: { circleId: circle.id, name: project, targetAmount: goal, createdById: userId } })
    log(circle.id, "CHURCH", "create", "SUCCESS", "Project goal created")
  } catch (e) { log(circle.id, "CHURCH", "create", "FAILED", `Goal: ${e}`) }

  await createExpenseCategories(circle.id, ["Tithe", "Offering", "Building Fund", "Outreach"])
  await createWidget(circle.id, { type: "PROJECT_PROGRESS", title: project, description: "Project progress", sortOrder: 1 })
  await createWidget(circle.id, { type: "CONTRIBUTION_SUMMARY", title: "Donations", description: "Total received", sortOrder: 2 })
}

export async function applyInvestmentTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  const monthly = Number(settings.monthlyContribution) || 5000
  const investmentGoal = (settings.investmentGoal as string) || "Investment Fund"
  try {
    await prisma.contributionPlan.create({ data: { circleId: circle.id, name: "Monthly Investment", amount: monthly, frequency: "MONTHLY" as ContributionFrequency, dueDay: 1, startDate: new Date(), createdById: userId } })
    log(circle.id, "INVESTMENT", "create", "SUCCESS", "Investment plan created")
  } catch (e) { log(circle.id, "INVESTMENT", "create", "FAILED", `Plan: ${e}`) }

  try { await prisma.goal.create({ data: { circleId: circle.id, name: investmentGoal, targetAmount: monthly * 12, createdById: userId } }) } catch {}

  await createWidget(circle.id, { type: "CONTRIBUTION_SUMMARY", title: "Contributions", description: "Total invested", sortOrder: 1 })
  await createWidget(circle.id, { type: "PORTFOLIO_PLACEHOLDER", title: "Portfolio", description: "Track investments", sortOrder: 2 })
}

export async function applyCustomTemplate(circle: { id: string; name: string; type: string; currency: string }, userId: string, settings: Record<string, unknown>) {
  if (settings.enableContributions) await createWidget(circle.id, { type: "CONTRIBUTION_SUMMARY", title: "Contributions", sortOrder: 1 })
  if (settings.enableExpenses) await createWidget(circle.id, { type: "EXPENSE_SUMMARY", title: "Expenses", sortOrder: 2 })
  if (settings.enableGoals) await createWidget(circle.id, { type: "GOAL_PROGRESS", title: "Goals", sortOrder: 3 })
  if (settings.enableBalances) await createWidget(circle.id, { type: "BALANCE_SUMMARY", title: "Balances", sortOrder: 4 })
}

export async function getAutomationLogs(circleId: string) {
  return prisma.circleAutomationLog.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } })
}

export async function getCircleWidgets(circleId: string) {
  return prisma.circleWidget.findMany({ where: { circleId, isActive: true }, orderBy: { sortOrder: "asc" } })
}
