import { prisma } from "@/lib/prisma"

const DEFAULT_WORKFLOWS: Record<string, { title: string; description: string }[]> = {
  STOKVEL: [
    { title: "Setup monthly contribution", description: "Configure contribution amount and schedule" },
    { title: "Collect contributions", description: "Members pay their monthly dues" },
    { title: "Track unpaid members", description: "Follow up on outstanding payments" },
    { title: "Close collection", description: "Finalize this month's collection" },
    { title: "Approve payout", description: "Approve the payout to the next recipient" },
    { title: "Complete payout", description: "Mark the payout as completed" },
    { title: "Start next cycle", description: "Begin the next month's cycle" },
  ],
  INVESTMENT: [
    { title: "Setup monthly investment due", description: "Configure monthly contribution amount" },
    { title: "Collect capital", description: "Members contribute capital" },
    { title: "Allocate capital", description: "Decide where to invest" },
    { title: "Add investment asset", description: "Record purchased assets" },
    { title: "Update asset value", description: "Update current market values" },
    { title: "Record return/dividend", description: "Log returns or dividends" },
    { title: "Review ownership shares", description: "Check member ownership percentages" },
  ],
  HOUSEMATE: [
    { title: "Setup rent and bills", description: "Configure monthly rent and recurring bills" },
    { title: "Record rent payment", description: "Add rent payment for the month" },
    { title: "Add household expenses", description: "Log utilities, groceries, etc." },
    { title: "Split expenses", description: "Divide expenses among housemates" },
    { title: "Settle balances", description: "Resolve who owes who" },
    { title: "Close month", description: "Finalize this month" },
  ],
  TRAVEL: [
    { title: "Set destination and budget", description: "Define trip details and target amount" },
    { title: "Collect travel savings", description: "Members contribute to the trip fund" },
    { title: "Track bookings", description: "Record flights, hotels, activities" },
    { title: "Add trip expenses", description: "Log on-trip spending" },
    { title: "Review budget", description: "Check against trip budget" },
    { title: "Close trip", description: "Finalize trip accounting" },
  ],
  SAVINGS: [
    { title: "Set savings target", description: "Define the savings goal amount and deadline" },
    { title: "Collect savings", description: "Members contribute savings" },
    { title: "Track progress", description: "Monitor goal progress" },
    { title: "Review projected completion", description: "Estimate completion date" },
    { title: "Complete goal", description: "Goal reached — celebrate!" },
  ],
  WEDDING: [
    { title: "Set wedding budget", description: "Define total budget" },
    { title: "Collect contributions", description: "Members contribute" },
    { title: "Track vendor expenses", description: "Record payments to vendors" },
    { title: "Review budget", description: "Check remaining budget" },
    { title: "Finalize wedding fund", description: "Close the fund" },
  ],
  CHURCH: [
    { title: "Set project/fundraising goal", description: "Define the project or campaign" },
    { title: "Collect offerings/contributions", description: "Members give" },
    { title: "Track project expenses", description: "Record project spending" },
    { title: "Review project progress", description: "Check progress towards goal" },
    { title: "Close campaign", description: "Finalize the campaign" },
  ],
  FAMILY: [
    { title: "Set family fund purpose", description: "Define what the fund is for" },
    { title: "Collect contributions", description: "Family members contribute" },
    { title: "Track family expenses", description: "Log family spending" },
    { title: "Approve support payout", description: "Authorize a payout" },
    { title: "Review family fund", description: "Check fund balance" },
  ],
  CUSTOM: [
    { title: "Configure modules", description: "Set up the circle modules" },
    { title: "Invite members", description: "Grow your circle" },
    { title: "Track activity", description: "Monitor circle activity" },
    { title: "Review reports", description: "Check circle performance" },
  ],
}

export async function ensureCircleWorkflow(circleId: string) {
  const existing = await prisma.circleWorkflow.findUnique({ where: { circleId }, include: { steps: true } })
  if (existing) return existing

  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle) throw new Error("Circle not found")

  const steps = DEFAULT_WORKFLOWS[circle.type] || DEFAULT_WORKFLOWS.CUSTOM

  const workflow = await prisma.circleWorkflow.create({
    data: {
      circleId,
      type: circle.type as any,
      steps: {
        create: steps.map((s, i) => ({
          key: `step_${i + 1}`,
          title: s.title,
          description: s.description,
          sortOrder: i,
          status: i === 0 ? "IN_PROGRESS" : "TODO",
        })),
      },
      events: { create: { eventType: "WORKFLOW_CREATED", message: `Workflow created for ${circle.type}` } },
    },
  })

  await prisma.circleWorkflow.update({ where: { id: workflow.id }, data: { currentStep: "step_1" } })
  return prisma.circleWorkflow.findUnique({ where: { id: workflow.id }, include: { steps: { orderBy: { sortOrder: "asc" } }, events: { orderBy: { createdAt: "desc" }, take: 20 } } }) as any
}

export async function getCircleWorkflow(circleId: string) {
  const wf = await prisma.circleWorkflow.findUnique({
    where: { circleId },
    include: { steps: { orderBy: { sortOrder: "asc" } }, events: { orderBy: { createdAt: "desc" }, take: 20 } },
  })
  return wf
}

export async function completeWorkflowStep(circleId: string, stepKey: string, userId: string) {
  const wf = await prisma.circleWorkflow.findUnique({ where: { circleId }, include: { steps: { orderBy: { sortOrder: "asc" } } } })
  if (!wf) throw new Error("No workflow")
  const step = wf.steps.find((s) => s.key === stepKey)
  if (!step) throw new Error("Step not found")
  await prisma.circleWorkflowStep.update({ where: { id: step.id }, data: { status: "COMPLETED", completedAt: new Date(), completedById: userId } })
  await prisma.circleWorkflowEvent.create({ data: { workflowId: wf.id, stepId: step.id, userId, eventType: "STEP_COMPLETED", message: `Completed: ${step.title}` } })

  const nextStep = wf.steps.find((s) => s.sortOrder === step.sortOrder + 1 && s.status === "TODO")
  if (nextStep) {
    await prisma.circleWorkflowStep.update({ where: { id: nextStep.id }, data: { status: "IN_PROGRESS" } })
    await prisma.circleWorkflow.update({ where: { id: wf.id }, data: { currentStep: nextStep.key } })
    await prisma.circleWorkflowEvent.create({ data: { workflowId: wf.id, stepId: nextStep.id, userId, eventType: "STEP_STARTED", message: `Started: ${nextStep.title}` } })
  } else {
    await prisma.circleWorkflow.update({ where: { id: wf.id }, data: { status: "COMPLETED" } })
    await prisma.circleWorkflowEvent.create({ data: { workflowId: wf.id, userId, eventType: "CYCLE_COMPLETED", message: "Workflow cycle completed" } })
  }
  return true
}

export async function skipWorkflowStep(circleId: string, stepKey: string, userId: string) {
  const wf = await prisma.circleWorkflow.findUnique({ where: { circleId }, include: { steps: { orderBy: { sortOrder: "asc" } } } })
  if (!wf) throw new Error("No workflow")
  const step = wf.steps.find((s) => s.key === stepKey)
  if (!step) throw new Error("Step not found")
  await prisma.circleWorkflowStep.update({ where: { id: step.id }, data: { status: "SKIPPED" } })
  await prisma.circleWorkflowEvent.create({ data: { workflowId: wf.id, stepId: step.id, userId, eventType: "STEP_SKIPPED", message: `Skipped: ${step.title}` } })

  const nextStep = wf.steps.find((s) => s.sortOrder === step.sortOrder + 1 && s.status === "TODO")
  if (nextStep) {
    await prisma.circleWorkflowStep.update({ where: { id: nextStep.id }, data: { status: "IN_PROGRESS" } })
    await prisma.circleWorkflow.update({ where: { id: wf.id }, data: { currentStep: nextStep.key } })
  }
  return true
}

export async function resetWorkflow(circleId: string, userId: string) {
  const wf = await prisma.circleWorkflow.findUnique({ where: { circleId }, include: { steps: true } })
  if (!wf) throw new Error("No workflow")
  for (const step of wf.steps) {
    await prisma.circleWorkflowStep.update({ where: { id: step.id }, data: { status: step.sortOrder === 0 ? "IN_PROGRESS" : "TODO", completedAt: null, completedById: null } })
  }
  await prisma.circleWorkflow.update({ where: { id: wf.id }, data: { status: "ACTIVE", currentStep: "step_1" } })
  await prisma.circleWorkflowEvent.create({ data: { workflowId: wf.id, userId, eventType: "CYCLE_STARTED", message: "Workflow reset — new cycle started" } })
  return true
}

export async function startNextCycle(circleId: string, userId: string) {
  return resetWorkflow(circleId, userId)
}
