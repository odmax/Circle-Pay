import { prisma } from "@/lib/prisma"

const DEFAULTS: Record<string, { name: string; type: string; triggerType: string; actionType: string; triggerConfig: Record<string, unknown>; actionConfig: Record<string, unknown> }[]> = {
  STOKVEL: [
    { name: "Contribution reminder", type: "CONTRIBUTION_REMINDER", triggerType: "DAYS_BEFORE_DUE", actionType: "SEND_NOTIFICATION", triggerConfig: { days: 3 }, actionConfig: { message: "Reminder: Contribution is due in 3 days" } },
    { name: "Overdue reminder", type: "OVERDUE_REMINDER", triggerType: "DAYS_AFTER_DUE", actionType: "SEND_NOTIFICATION", triggerConfig: { days: 1 }, actionConfig: { message: "Your contribution is overdue" } },
    { name: "Monthly cycle reset", type: "MONTHLY_CYCLE_RESET", triggerType: "MONTHLY", actionType: "RESET_WORKFLOW", triggerConfig: { dayOfMonth: 1 }, actionConfig: {} },
  ],
  INVESTMENT: [
    { name: "Monthly due reminder", type: "CONTRIBUTION_REMINDER", triggerType: "DAYS_BEFORE_DUE", actionType: "SEND_NOTIFICATION", triggerConfig: { days: 3 }, actionConfig: { message: "Monthly investment due approaching" } },
    { name: "Portfolio review", type: "CUSTOM", triggerType: "MONTHLY", actionType: "CREATE_FEED_POST", triggerConfig: { dayOfMonth: 15 }, actionConfig: { message: "Monthly portfolio review reminder" } },
  ],
  HOUSEMATE: [
    { name: "Rent reminder", type: "CONTRIBUTION_REMINDER", triggerType: "DAYS_BEFORE_DUE", actionType: "SEND_NOTIFICATION", triggerConfig: { days: 3 }, actionConfig: { message: "Rent is due in 3 days" } },
    { name: "Monthly split", type: "MONTHLY_CYCLE_RESET", triggerType: "MONTHLY", actionType: "CREATE_FEED_POST", triggerConfig: { dayOfMonth: 1 }, actionConfig: { message: "Time to split this month's expenses" } },
  ],
  TRAVEL: [
    { name: "Savings reminder", type: "CONTRIBUTION_REMINDER", triggerType: "WEEKLY", actionType: "SEND_NOTIFICATION", triggerConfig: {}, actionConfig: { message: "Don't forget to save for your trip" } },
  ],
  SAVINGS: [
    { name: "Savings reminder", type: "CONTRIBUTION_REMINDER", triggerType: "WEEKLY", actionType: "SEND_NOTIFICATION", triggerConfig: {}, actionConfig: { message: "Keep up your savings goal" } },
  ],
  WEDDING: [
    { name: "Budget review", type: "CUSTOM", triggerType: "MONTHLY", actionType: "SEND_NOTIFICATION", triggerConfig: { dayOfMonth: 1 }, actionConfig: { message: "Monthly wedding budget review" } },
  ],
  CHURCH: [
    { name: "Contribution reminder", type: "CONTRIBUTION_REMINDER", triggerType: "WEEKLY", actionType: "SEND_NOTIFICATION", triggerConfig: {}, actionConfig: { message: "Weekly offering reminder" } },
  ],
  FAMILY: [
    { name: "Fund review", type: "CUSTOM", triggerType: "MONTHLY", actionType: "SEND_NOTIFICATION", triggerConfig: { dayOfMonth: 1 }, actionConfig: { message: "Monthly family fund review" } },
  ],
  CUSTOM: [],
}

export async function ensureDefaultAutomations(circleId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle) return
  const defaults = DEFAULTS[circle.type] || []
  for (const d of defaults) {
    const existing = await prisma.circleAutomationRule.findFirst({ where: { circleId, name: d.name } })
    if (!existing) {
      await prisma.circleAutomationRule.create({
        data: {
          circleId, type: d.type as any, name: d.name, triggerType: d.triggerType as any, actionType: d.actionType as any,
          triggerConfig: d.triggerConfig as any, actionConfig: d.actionConfig as any,
          nextRunAt: new Date(Date.now() + 86400000),
        },
      }).catch(() => {}) // ignore duplicate key errors
    }
  }
}

export async function getCircleAutomations(circleId: string) {
  const automations = await prisma.circleAutomationRule.findMany({
    where: { circleId },
    include: { runs: { orderBy: { startedAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  })
  return automations
}

export async function updateAutomationRule(ruleId: string, data: { isEnabled?: boolean }) {
  return prisma.circleAutomationRule.update({ where: { id: ruleId }, data })
}

export async function runAutomationRule(ruleId: string) {
  const rule = await prisma.circleAutomationRule.findUnique({ where: { id: ruleId }, include: { circle: { select: { members: { select: { userId: true } } } } } })
  if (!rule || !rule.isEnabled) return { status: "skipped" }

  const run = await prisma.circleAutomationRun.create({ data: { ruleId: rule.id, circleId: rule.circleId, status: "RUNNING" } })
  try {
    if (rule.actionType === "SEND_NOTIFICATION") {
      const msg = (rule.actionConfig as any)?.message || "Automated reminder"
      for (const m of rule.circle.members) {
        await prisma.notification.create({ data: { userId: m.userId, circleId: rule.circleId, type: "CONTRIBUTION_REMINDER" as any, title: rule.name, message: msg } }).catch(() => {})
      }
    } else if (rule.actionType === "CREATE_FEED_POST") {
      const msg = (rule.actionConfig as any)?.message || "Automated post"
      await prisma.feedPost.create({ data: { circleId: rule.circleId, authorId: "system", content: msg } }).catch(() => {})
    } else if (rule.actionType === "RESET_WORKFLOW") {
      const wf = await prisma.circleWorkflow.findUnique({ where: { circleId: rule.circleId } })
      if (wf) {
        await prisma.circleWorkflowStep.updateMany({ where: { workflowId: wf.id }, data: { status: "TODO", completedAt: null, completedById: null } })
        await prisma.circleWorkflowStep.updateMany({ where: { workflowId: wf.id, sortOrder: 0 }, data: { status: "IN_PROGRESS" } })
        await prisma.circleWorkflow.update({ where: { id: wf.id }, data: { status: "ACTIVE", currentStep: "step_1" } })
      }
    }
    await prisma.circleAutomationRun.update({ where: { id: run.id }, data: { status: "SUCCESS", completedAt: new Date(), message: "OK" } })
    await prisma.circleAutomationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date(), nextRunAt: new Date(Date.now() + 7 * 86400000) } })
    return { status: "success" }
  } catch (e) {
    await prisma.circleAutomationRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), message: (e as Error).message } })
    return { status: "failed", error: (e as Error).message }
  }
}

export async function runDueAutomations() {
  const now = new Date()
  const due = await prisma.circleAutomationRule.findMany({ where: { isEnabled: true, nextRunAt: { lte: now } } })
  let success = 0; let failed = 0
  for (const rule of due) {
    const result = await runAutomationRule(rule.id)
    if (result.status === "success") success++; else failed++
  }
  return { total: due.length, success, failed }
}
