/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { computeBillShares } from "@/lib/services/household-bills.service"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const PURCHASE_CATEGORIES = ["GROCERIES", "CLEANING", "TOILETRIES", "EQUIPMENT", "FURNITURE", "KITCHEN", "SUBSCRIPTION", "CUSTOM"]
const RUN_STATUSES = ["PLANNED", "SHOPPING", "COMPLETED", "CANCELLED"]

export function toShares(p: { amount: number; splitType: string; splitConfig: Array<{ userId: string; amount?: number; percentage?: number }> | null; participantIds: string[] }): Record<string, number> {
  return computeBillShares({ splitType: p.splitType, expectedAmount: p.amount, shareConfig: p.splitConfig, participatingIds: p.participantIds })
}

async function notifyUsers(circleId: string, userIds: string[], type: any, title: string, message: string) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  await createBulkNotifications(ids.map((userId) => ({ userId, circleId, type, title, message, link: `/circles/${circleId}/groceries` }))).catch(() => {})
}

// ─── Shared Purchases ───────────────────────────────────────

export async function createSharedPurchase(circleId: string, actorId: string, isManager: boolean, data: any) {
  const title = (data.title || "").trim()
  if (!title) throw new Error("Purchase title is required")
  const amount = asNum(data.amount)
  if (amount <= 0) throw new Error("Amount must be greater than zero")
  const paidById = data.paidById || actorId
  if (!isManager && paidById !== actorId) throw new Error("You can only record purchases you paid for yourself")

  const participantIds: string[] = (Array.isArray(data.participantIds) && data.participantIds.length ? data.participantIds : [paidById])
  const splitType = (data.splitType || "EQUAL").toUpperCase()
  const splitConfig = Array.isArray(data.splitConfig) ? data.splitConfig : null

  // Single ledger post through the existing shared expense engine.
  const { createExpense } = await import("@/lib/services/expense.service")
  const splits = participantIds.map((uid) => ({ userId: uid }))
  let expenseId: string | null = null
  try {
    const expense = await createExpense(circleId, actorId, {
      title, notes: data.store ? `Store: ${data.store}` : undefined,
      amount, category: (data.category || "groceries").toLowerCase(),
      splitType, expenseDate: data.purchaseDate || new Date().toISOString(),
      paidById, splits,
    })
    expenseId = expense.id
  } catch { /* ledger post failed — record without posting to avoid duplicates */ }

  const purchase = await prisma.householdSharedPurchase.create({
    data: {
      circleId, createdById: actorId, runId: data.runId ?? null,
      title, category: (data.category || "GROCERIES") as any, store: data.store ?? null,
      amount, purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
      paidById, splitType, participantIds, splitConfig,
      notes: data.notes ?? null, receiptUrl: data.receiptUrl ?? null, expenseId,
    },
  })
  await createAuditLog({ userId: actorId, circleId, action: "HOUSEHOLD_PURCHASE_CREATED", entityType: "HouseholdSharedPurchase", entityId: purchase.id, newValues: { title, amount } })
  await notifyUsers(circleId, [paidById, ...participantIds], "FEED_POST_CREATED", `Shared purchase added: ${title}`, `${asNum(amount).toLocaleString()} recorded.`)
  return purchase
}

export async function listSharedPurchases(circleId: string, viewerUserId: string) {
  const purchases = await prisma.householdSharedPurchase.findMany({
    where: { circleId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { purchaseDate: "desc" },
  })
  const payerIds = Array.from(new Set(purchases.map((p) => p.paidById)))
  const payers = payerIds.length ? await prisma.user.findMany({ where: { id: { in: payerIds } }, select: { id: true, name: true } }) : []
  const payerName = new Map(payers.map((u) => [u.id, u.name]))
  const mapped = purchases.map((p) => {
    const shares = toShares({ amount: asNum(p.amount), splitType: p.splitType, splitConfig: (p.splitConfig as any) || null, participantIds: ((p.participantIds as any) || []) })
    return {
      id: p.id, runId: p.runId, title: p.title, category: p.category, store: p.store,
      amount: asNum(p.amount), purchaseDate: p.purchaseDate.toISOString(),
      paidByName: payerName.get(p.paidById) ?? null, paidById: p.paidById, splitType: p.splitType,
      notes: p.notes, receiptUrl: p.receiptUrl, expenseId: p.expenseId,
      isMine: p.paidById === viewerUserId || p.createdById === viewerUserId,
      shares, myShare: asNum(shares[viewerUserId]),
    }
  })
  return { purchases: mapped }
}

export async function updateSharedPurchase(circleId: string, purchaseId: string, actorId: string, isManager: boolean, data: any) {
  const p = await prisma.householdSharedPurchase.findFirst({ where: { id: purchaseId, circleId } })
  if (!p) throw new Error("Not found")
  if (!isManager && p.paidById !== actorId && p.createdById !== actorId) throw new Error("You can only edit purchases you paid for")
  const safe: any = {}
  for (const k of ["title", "category", "store", "notes", "receiptUrl"]) if (data[k] !== undefined) safe[k] = data[k]
  // Amount/payer/split are ledger-backed and only mutable before a ledger post.
  if (!p.expenseId) {
    if (data.amount !== undefined) safe.amount = asNum(data.amount)
    if (data.paidById !== undefined) safe.paidById = data.paidById
    if (data.participantIds) safe.participantIds = data.participantIds
    if (data.splitType) safe.splitType = String(data.splitType).toUpperCase()
    if (data.splitConfig) safe.splitConfig = data.splitConfig
  }
  const updated = await prisma.householdSharedPurchase.update({ where: { id: purchaseId }, data: safe })
  await createAuditLog({ userId: actorId, circleId, action: "HOUSEHOLD_PURCHASE_UPDATED", entityType: "HouseholdSharedPurchase", entityId: purchaseId, newValues: safe })
  return updated
}

export async function deleteSharedPurchase(circleId: string, purchaseId: string, actorId: string, isManager: boolean) {
  const p = await prisma.householdSharedPurchase.findFirst({ where: { id: purchaseId, circleId } })
  if (!p) throw new Error("Not found")
  if (!isManager && p.paidById !== actorId && p.createdById !== actorId) throw new Error("You can only delete purchases you paid for")
  await prisma.householdSharedPurchase.delete({ where: { id: purchaseId } })
  await createAuditLog({ userId: actorId, circleId, action: "HOUSEHOLD_PURCHASE_DELETED", entityType: "HouseholdSharedPurchase", entityId: purchaseId })
  return { ok: true }
}

// ─── Grocery Runs ───────────────────────────────────────────

export async function getGroceryRuns(circleId: string, viewerUserId: string) {
  await reconcileRunSpend(circleId)
  const runs = await prisma.householdGroceryRun.findMany({
    where: { circleId },
    include: { items: { include: { addedBy: { select: { name: true } } } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return runs.map((r) => ({
    id: r.id, title: r.title, status: r.status, assignedShopperId: r.assignedShopperId,
    expectedBudget: r.expectedBudget != null ? asNum(r.expectedBudget) : null,
    actualSpend: r.actualSpend != null ? asNum(r.actualSpend) : null,
    scheduledFor: r.scheduledFor ? r.scheduledFor.toISOString() : null,
    notes: r.notes, createdAt: r.createdAt.toISOString(), createdByName: r.createdBy?.name ?? null,
    items: r.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, category: i.category, priority: i.priority, purchased: i.purchased, purchasedById: i.purchasedById, note: i.note, addedByName: i.addedBy?.name ?? null, canModify: i.addedById === viewerUserId || r.assignedShopperId === viewerUserId || (i.purchased ? false : i.addedById === viewerUserId) })),
    purchasedCount: r.items.filter((i) => i.purchased).length,
    totalItems: r.items.length,
  }))
}

async function reconcileRunSpend(circleId: string) {
  const runs = await prisma.householdGroceryRun.findMany({ where: { circleId }, select: { id: true } })
  for (const r of runs) {
    const sum = await prisma.householdSharedPurchase.aggregate({ where: { runId: r.id }, _sum: { amount: true } })
    if (sum._sum.amount != null) {
      await prisma.householdGroceryRun.update({ where: { id: r.id }, data: { actualSpend: sum._sum.amount } })
    }
  }
}

export async function createGroceryRun(circleId: string, actorId: string, isManager: boolean, data: any) {
  const run = await prisma.householdGroceryRun.create({
    data: {
      circleId, createdById: actorId,
      title: (data.title || "").trim() || "Grocery run",
      assignedShopperId: data.assignedShopperId ?? null,
      expectedBudget: data.expectedBudget != null ? asNum(data.expectedBudget) : null,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
      notes: data.notes ?? null,
    },
  })
  if (Array.isArray(data.items)) {
    for (const it of data.items.slice(0, 50)) {
      const name = String(it?.name || "").trim()
      if (!name) continue
      await prisma.householdGroceryItem.create({ data: { runId: run.id, addedById: actorId, name, quantity: Number(it?.quantity) || 1 } }).catch(() => {})
    }
  }
  await createAuditLog({ userId: actorId, circleId, action: "GROCERY_RUN_CREATED", entityType: "HouseholdGroceryRun", entityId: run.id })
  if (run.assignedShopperId) {
    await notifyUsers(circleId, [run.assignedShopperId], "FEED_POST_CREATED", `You are the shopper for ${run.title}`, "A grocery run was assigned to you.")
  }
  return run
}

export async function addGroceryItem(circleId: string, runId: string, actorId: string, data: any) {
  const run = await prisma.householdGroceryRun.findFirst({ where: { id: runId, circleId } })
  if (!run) throw new Error("Not found")
  if (run.status === "COMPLETED" || run.status === "CANCELLED") throw new Error("Run already finished")
  const name = String(data.name || "").trim()
  if (!name) throw new Error("Item name is required")
  const existing = await prisma.householdGroceryItem.findUnique({ where: { runId_name: { runId, name } } })
  if (existing) throw new Error("Item already on the list")
  const item = await prisma.householdGroceryItem.create({
    data: {
      runId, addedById: actorId, name, quantity: Number(data.quantity) || 1,
      unit: data.unit ?? null, category: data.category ?? null, priority: Number(data.priority) || 0, note: data.note ?? null,
    },
  })
  if (run.assignedShopperId && run.assignedShopperId !== actorId) {
    await notifyUsers(circleId, [run.assignedShopperId], "FEED_POST_CREATED", `Item added to ${run.title}`, `"${name}" was added to the list.`)
  }
  return item
}

export async function updateGroceryItem(circleId: string, runId: string, itemId: string, actorId: string, data: any) {
  const run = await prisma.householdGroceryRun.findFirst({ where: { id: runId, circleId } })
  const item = await prisma.householdGroceryItem.findFirst({ where: { id: itemId, runId } })
  if (!run || !item) throw new Error("Not found")
  const isShopper = !!run.assignedShopperId && run.assignedShopperId === actorId
  if (!isShopper && item.addedById !== actorId && data.purchased !== undefined) throw new Error("Only the shopper or the person who added the item can change it")
  const safe: any = {}
  if (data.purchased !== undefined) { safe.purchased = !!data.purchased; safe.purchasedById = data.purchased ? actorId : null; safe.purchasedAt = data.purchased ? new Date() : null }
  if (data.quantity !== undefined) safe.quantity = Number(data.quantity) || 1
  if (data.priority !== undefined) safe.priority = Number(data.priority) || 0
  if (data.note !== undefined) safe.note = data.note
  if (data.name !== undefined) safe.name = String(data.name || "").trim() || item.name
  return prisma.householdGroceryItem.update({ where: { id: itemId }, data: safe })
}

export async function transitionGroceryRun(circleId: string, runId: string, actorId: string, status: string) {
  if (!RUN_STATUSES.includes(status)) throw new Error("Invalid run status")
  const run = await prisma.householdGroceryRun.findFirst({ where: { id: runId, circleId } })
  if (!run) throw new Error("Not found")
  const updated = await prisma.householdGroceryRun.update({ where: { id: runId }, data: { status } })
  await createAuditLog({ userId: actorId, circleId, action: "GROCERY_RUN_STATUS", entityType: "HouseholdGroceryRun", entityId: runId, oldValues: { status: run.status }, newValues: { status } })
  if (status === "COMPLETED") await reconcileRunSpend(circleId)
  if (status === "COMPLETED" || status === "SHOPPING") {
    await notifyUsers(circleId, [run.assignedShopperId || actorId], "FEED_POST_CREATED", `Grocery run ${status.toLowerCase()}: ${run.title}`, status === "COMPLETED" ? "The run is complete." : "Shopping in progress.")
  }
  return updated
}

// ─── Dashboard Summary ──────────────────────────────────────

export async function getGroceriesSummary(circleId: string, viewerUserId: string) {
  const purchases = await prisma.householdSharedPurchase.findMany({ where: { circleId }, orderBy: { purchaseDate: "desc" } })
  const runs = await getGroceryRuns(circleId, viewerUserId)
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const inMonth = (d: Date) => d.toISOString().slice(0, 7) === monthKey
  const thisMonth = purchases.filter((p) => inMonth(p.purchaseDate))
  const groceriesThisMonth = thisMonth.filter((p) => p.category === "GROCERIES").reduce((s, p) => s + asNum(p.amount), 0)
  const sharedThisMonth = thisMonth.reduce((s, p) => s + asNum(p.amount), 0)
  const mySpend = purchases.filter((p) => p.paidById === viewerUserId).reduce((s, p) => s + asNum(p.amount), 0)
  const lastPayerId = purchases[0]?.paidById ?? null
  const lastPayer = lastPayerId ? (await prisma.user.findUnique({ where: { id: lastPayerId }, select: { name: true } }))?.name ?? null : null
  const upcomingRun = runs.find((r) => (r.status === "PLANNED" || r.status === "SHOPPING")) ?? null
  const balances = await (await import("@/lib/services/balance.service")).getCircleBalances(circleId, viewerUserId)
  const myOwed = purchases
    .filter((p) => p.paidById === viewerUserId)
    .reduce((s, p) => s + ((toShares({ amount: asNum(p.amount), splitType: p.splitType, splitConfig: (p.splitConfig as any) || null, participantIds: ((p.participantIds as any) || []) })[viewerUserId]) || 0), 0)
  return {
    groceriesThisMonth,
    sharedThisMonth,
    mySpend,
    amountOwedToMe: Math.round((mySpend - myOwed) * 100) / 100,
    lastPayer,
    upcomingRun: upcomingRun ? { id: upcomingRun.id, title: upcomingRun.title, status: upcomingRun.status, scheduledFor: upcomingRun.scheduledFor, totalItems: upcomingRun.totalItems, purchasedCount: upcomingRun.purchasedCount } : null,
    unsettledBalances: balances.allBalances.length,
  }
}