import { prisma } from "@/lib/prisma"
import { requireCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"

interface StatementTransaction {
  date: string
  type: string
  description: string
  amount: number
  inflow: number
  outflow: number
  balance: number
  receiptNumber?: string
}

interface MemberStatementResult {
  circle: { id: string; name: string; currency: string }
  member: { id: string; name: string; email: string }
  period: { from: string; to: string }
  openingBalance: number
  totalInflows: number
  totalOutflows: number
  closingBalance: number
  transactions: StatementTransaction[]
}

interface CircleStatementResult {
  circle: { id: string; name: string; currency: string }
  period: { from: string; to: string }
  openingBalance: number
  totalInflows: number
  totalOutflows: number
  closingBalance: number
  transactions: StatementTransaction[]
}

interface PlanMemberSummary {
  member: { id: string; name: string; email: string }
  totalContributed: number
  contributions: {
    date: string
    amount: number
    status: string
    note?: string | null
    receiptNumber?: string
  }[]
}

interface PlanStatementResult {
  circle: { id: string; name: string; currency: string }
  plan: { id: string; name: string; amount: number; frequency: string }
  period: { from: string; to: string }
  totalContributions: number
  memberSummaries: PlanMemberSummary[]
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function defaultPeriod(from?: Date, to?: Date): { from: Date; to: Date } {
  const now = new Date()
  return {
    from: from ?? new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to: to ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  }
}

async function loadReceiptNumbers(resourceIds: string[]): Promise<Map<string, string>> {
  if (resourceIds.length === 0) return new Map()
  const receipts = await prisma.financialReceipt.findMany({
    where: { resourceId: { in: resourceIds }, status: "ACTIVE" },
    select: { resourceId: true, receiptNumber: true },
  })
  return new Map(receipts.map((r) => [r.resourceId, r.receiptNumber]))
}

export async function generateMemberStatementData(
  circleId: string,
  memberId: string,
  from?: Date,
  to?: Date
): Promise<MemberStatementResult> {
  await requireCirclePermission({ userId: memberId, circleId, permission: CIRCLE_PERMISSIONS.LEDGER_VIEW })

  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    select: { id: true, name: true, currency: true },
  })

  const member = await prisma.user.findUniqueOrThrow({
    where: { id: memberId },
    select: { id: true, name: true, email: true },
  })

  const period = defaultPeriod(from, to)

  const [contributions, expenses, settlements] = await Promise.all([
    prisma.contribution.findMany({
      where: {
        circleId,
        userId: memberId,
        deletedAt: null,
        OR: [
          { status: "CONFIRMED" },
          { status: "PAID" },
        ],
      },
      select: { id: true, amount: true, paymentDate: true, note: true, status: true, createdAt: true },
      orderBy: { paymentDate: "asc" },
    }),
    prisma.expense.findMany({
      where: {
        circleId,
        paidById: memberId,
        deletedAt: null,
      },
      select: { id: true, amount: true, title: true, expenseDate: true, createdAt: true },
      orderBy: { expenseDate: "asc" },
    }),
    prisma.settlement.findMany({
      where: {
        circleId,
        deletedAt: null,
        status: "CONFIRMED",
        OR: [{ debtorId: memberId }, { creditorId: memberId }],
      },
      select: {
        id: true,
        amount: true,
        debtorId: true,
        creditorId: true,
        settlementDate: true,
        note: true,
        createdAt: true,
      },
      orderBy: { settlementDate: "asc" },
    }),
  ])

  const allTxBeforePeriod: { amount: number; direction: "in" | "out"; date: Date }[] = []
  const allTxInPeriod: {
    id: string
    amount: number
    direction: "in" | "out"
    date: Date
    type: string
    description: string
    createdAt: Date
  }[] = []

  for (const c of contributions) {
    const entry = { amount: Number(c.amount), direction: "in" as const, date: c.paymentDate, createdAt: c.createdAt }
    if (c.paymentDate < period.from) {
      allTxBeforePeriod.push(entry)
    } else if (c.paymentDate <= period.to) {
      allTxInPeriod.push({
        id: c.id,
        ...entry,
        type: "Contribution",
        description: c.note || "Contribution",
        createdAt: c.createdAt,
      })
    }
  }

  for (const e of expenses) {
    const entry = { amount: Number(e.amount), direction: "out" as const, date: e.expenseDate, createdAt: e.createdAt }
    if (e.expenseDate < period.from) {
      allTxBeforePeriod.push(entry)
    } else if (e.expenseDate <= period.to) {
      allTxInPeriod.push({
        id: e.id,
        ...entry,
        type: "Expense",
        description: e.title,
        createdAt: e.createdAt,
      })
    }
  }

  for (const s of settlements) {
    const isDebtor = s.debtorId === memberId
    const entry = {
      amount: Number(s.amount),
      direction: (isDebtor ? "out" : "in") as "in" | "out",
      date: s.settlementDate,
      createdAt: s.createdAt,
    }
    if (s.settlementDate < period.from) {
      allTxBeforePeriod.push(entry)
    } else if (s.settlementDate <= period.to) {
      allTxInPeriod.push({
        id: s.id,
        ...entry,
        type: "Settlement",
        description: s.note || (isDebtor ? "Settlement paid" : "Settlement received"),
        createdAt: s.createdAt,
      })
    }
  }

  const openingBalance = allTxBeforePeriod.reduce((bal, tx) => {
    return bal + (tx.direction === "in" ? tx.amount : -tx.amount)
  }, 0)

  allTxInPeriod.sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime())

  const receiptIds = allTxInPeriod.map((t) => t.id)
  const receiptMap = await loadReceiptNumbers(receiptIds)

  let runningBalance = openingBalance
  const transactions: StatementTransaction[] = allTxInPeriod.map((tx) => {
    const inflow = tx.direction === "in" ? tx.amount : 0
    const outflow = tx.direction === "out" ? tx.amount : 0
    runningBalance += inflow - outflow
    return {
      date: formatDate(tx.date),
      type: tx.type,
      description: tx.description,
      amount: tx.amount,
      inflow,
      outflow,
      balance: Math.round(runningBalance * 100) / 100,
      receiptNumber: receiptMap.get(tx.id),
    }
  })

  const totalInflows = transactions.reduce((s, t) => s + t.inflow, 0)
  const totalOutflows = transactions.reduce((s, t) => s + t.outflow, 0)

  return {
    circle,
    member: { ...member, name: member.name ?? "" },
    period: { from: formatDate(period.from), to: formatDate(period.to) },
    openingBalance: Math.round(openingBalance * 100) / 100,
    totalInflows: Math.round(totalInflows * 100) / 100,
    totalOutflows: Math.round(totalOutflows * 100) / 100,
    closingBalance: Math.round(runningBalance * 100) / 100,
    transactions,
  }
}

export async function generateCircleStatementData(
  circleId: string,
  userId: string,
  from?: Date,
  to?: Date
): Promise<CircleStatementResult> {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LEDGER_VIEW })

  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    select: { id: true, name: true, currency: true },
  })

  const period = defaultPeriod(from, to)

  const [contributions, expenses, settlements] = await Promise.all([
    prisma.contribution.findMany({
      where: {
        circleId,
        deletedAt: null,
        OR: [
          { status: "CONFIRMED" },
          { status: "PAID" },
        ],
      },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        note: true,
        userId: true,
        createdAt: true,
      },
      orderBy: { paymentDate: "asc" },
    }),
    prisma.expense.findMany({
      where: { circleId, deletedAt: null },
      select: { id: true, amount: true, title: true, paidById: true, expenseDate: true, createdAt: true },
      orderBy: { expenseDate: "asc" },
    }),
    prisma.settlement.findMany({
      where: { circleId, deletedAt: null, status: "CONFIRMED" },
      select: {
        id: true,
        amount: true,
        debtorId: true,
        creditorId: true,
        settlementDate: true,
        note: true,
        createdAt: true,
      },
      orderBy: { settlementDate: "asc" },
    }),
  ])

  const allTxBeforePeriod: { amount: number; direction: "in" | "out"; date: Date }[] = []
  const allTxInPeriod: {
    id: string
    amount: number
    direction: "in" | "out"
    date: Date
    type: string
    description: string
    createdAt: Date
  }[] = []

  for (const c of contributions) {
    const entry = { amount: Number(c.amount), direction: "in" as const, date: c.paymentDate, createdAt: c.createdAt }
    if (c.paymentDate < period.from) {
      allTxBeforePeriod.push(entry)
    } else if (c.paymentDate <= period.to) {
      allTxInPeriod.push({
        id: c.id,
        ...entry,
        type: "Contribution",
        description: c.note || `Contribution from ${c.userId}`,
        createdAt: c.createdAt,
      })
    }
  }

  for (const e of expenses) {
    const entry = { amount: Number(e.amount), direction: "out" as const, date: e.expenseDate, createdAt: e.createdAt }
    if (e.expenseDate < period.from) {
      allTxBeforePeriod.push(entry)
    } else if (e.expenseDate <= period.to) {
      allTxInPeriod.push({
        id: e.id,
        ...entry,
        type: "Expense",
        description: e.title,
        createdAt: e.createdAt,
      })
    }
  }

  for (const s of settlements) {
    const entry = {
      amount: Number(s.amount),
      direction: "in" as const,
      date: s.settlementDate,
      createdAt: s.createdAt,
    }
    if (s.settlementDate < period.from) {
      allTxBeforePeriod.push(entry)
    } else if (s.settlementDate <= period.to) {
      allTxInPeriod.push({
        id: s.id,
        ...entry,
        type: "Settlement",
        description: s.note || "Settlement",
        createdAt: s.createdAt,
      })
    }
  }

  const openingBalance = allTxBeforePeriod.reduce((bal, tx) => {
    return bal + (tx.direction === "in" ? tx.amount : -tx.amount)
  }, 0)

  allTxInPeriod.sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime())

  const receiptIds = allTxInPeriod.map((t) => t.id)
  const receiptMap = await loadReceiptNumbers(receiptIds)

  let runningBalance = openingBalance
  const transactions: StatementTransaction[] = allTxInPeriod.map((tx) => {
    const inflow = tx.direction === "in" ? tx.amount : 0
    const outflow = tx.direction === "out" ? tx.amount : 0
    runningBalance += inflow - outflow
    return {
      date: formatDate(tx.date),
      type: tx.type,
      description: tx.description,
      amount: tx.amount,
      inflow,
      outflow,
      balance: Math.round(runningBalance * 100) / 100,
      receiptNumber: receiptMap.get(tx.id),
    }
  })

  const totalInflows = transactions.reduce((s, t) => s + t.inflow, 0)
  const totalOutflows = transactions.reduce((s, t) => s + t.outflow, 0)

  return {
    circle,
    period: { from: formatDate(period.from), to: formatDate(period.to) },
    openingBalance: Math.round(openingBalance * 100) / 100,
    totalInflows: Math.round(totalInflows * 100) / 100,
    totalOutflows: Math.round(totalOutflows * 100) / 100,
    closingBalance: Math.round(runningBalance * 100) / 100,
    transactions,
  }
}

export async function generateContributionPlanStatementData(
  circleId: string,
  planId: string,
  userId: string,
  from?: Date,
  to?: Date
): Promise<PlanStatementResult> {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.LEDGER_VIEW })

  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    select: { id: true, name: true, currency: true },
  })

  const plan = await prisma.contributionPlan.findUniqueOrThrow({
    where: { id: planId },
    select: { id: true, name: true, amount: true, frequency: true, circleId: true },
  })

  if (plan.circleId !== circleId) {
    throw new Error("Plan does not belong to this circle")
  }

  const period = defaultPeriod(from, to)

  const contributions = await prisma.contribution.findMany({
    where: {
      circleId,
      planId,
      deletedAt: null,
      OR: [
        { status: "CONFIRMED" },
        { status: "PAID" },
      ],
      paymentDate: { gte: period.from, lte: period.to },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { paymentDate: "asc" },
  })

  const receiptIds = contributions.map((c) => c.id)
  const receiptMap = await loadReceiptNumbers(receiptIds)

  const memberMap = new Map<string, PlanMemberSummary>()

  for (const c of contributions) {
    const memberId = c.user.id
    if (!memberMap.has(memberId)) {
      memberMap.set(memberId, {
        member: { ...c.user, name: c.user.name ?? "" },
        totalContributed: 0,
        contributions: [],
      })
    }
    const summary = memberMap.get(memberId)!
    summary.totalContributed += Number(c.amount)
    summary.contributions.push({
      date: formatDate(c.paymentDate),
      amount: Number(c.amount),
      status: c.status,
      note: c.note,
      receiptNumber: receiptMap.get(c.id),
    })
  }

  const totalContributions = contributions.reduce((s, c) => s + Number(c.amount), 0)

  return {
    circle,
    plan: { id: plan.id, name: plan.name, amount: Number(plan.amount), frequency: plan.frequency },
    period: { from: formatDate(period.from), to: formatDate(period.to) },
    totalContributions: Math.round(totalContributions * 100) / 100,
    memberSummaries: Array.from(memberMap.values()),
  }
}
