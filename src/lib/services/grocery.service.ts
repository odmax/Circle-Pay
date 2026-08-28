import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification, notifyCircleMembers } from "@/lib/services/notification.service"

type Decimal = Prisma.Decimal

function dec(value: string | number | Decimal | null | undefined): Decimal {
  return new Prisma.Decimal(value ?? 0)
}

function toNumber(value: string | number | Decimal | null | undefined): number {
  return dec(value).toNumber()
}

const CONTRIB_SUCCESS = ["PAID", "CONFIRMED"] as const

async function requireMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

async function getCampaignOrThrow(circleId: string, campaignId: string) {
  const c = await prisma.groceryCampaign.findFirst({ where: { id: campaignId, circleId } })
  if (!c) throw new Error("Campaign not found")
  return c
}

// ─── Config ───────────────────────────────────────────────

export interface GroceryConfigView {
  enabled: boolean
}

export async function getGroceryConfig(circleId: string, userId: string): Promise<GroceryConfigView> {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_VIEW_OWN })
  const row = await prisma.circleGroceryConfig.findUnique({ where: { circleId } })
  return { enabled: row?.enabled ?? false }
}

export async function upsertGroceryConfig(
  circleId: string,
  userId: string,
  data: { enabled: boolean }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_MANAGE })
  const row = await prisma.circleGroceryConfig.upsert({
    where: { circleId },
    update: { enabled: data.enabled },
    create: { circleId, enabled: data.enabled, createdById: userId },
  })
  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_CONFIG_UPDATED",
    entityType: "CircleGroceryConfig",
    entityId: row.id,
    newValues: { enabled: data.enabled },
  }).catch(() => {})
  return row
}

// ─── Campaign ─────────────────────────────────────────────

export interface CreateCampaignInput {
  name: string
  description?: string
  targetAmount: number
  contributionStart?: string
  contributionEnd?: string
  distributionDate?: string
  estimatedCost?: number
}

export async function createCampaign(circleId: string, userId: string, input: CreateCampaignInput) {
  await requireMember(circleId, userId)
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_CREATE })

  const config = (await prisma.circleGroceryConfig.findUnique({ where: { circleId } })) ?? null
  if (config && !config.enabled) throw new Error("Grocery mode is not enabled for this circle")

  const target = new Prisma.Decimal(input.targetAmount)
  if (target.lte(0)) throw new Error("Target amount must be greater than zero")

  const campaign = await prisma.groceryCampaign.create({
    data: {
      circleId,
      name: input.name.trim(),
      description: input.description ?? null,
      targetAmount: target,
      contributionStart: input.contributionStart ? new Date(input.contributionStart) : null,
      contributionEnd: input.contributionEnd ? new Date(input.contributionEnd) : null,
      distributionDate: input.distributionDate ? new Date(input.distributionDate) : null,
      estimatedCost: input.estimatedCost != null ? new Prisma.Decimal(input.estimatedCost) : new Prisma.Decimal(0),
      status: "DRAFT",
      createdById: userId,
    },
  })

  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_CAMPAIGN_CREATED",
    entityType: "GroceryCampaign",
    entityId: campaign.id,
    newValues: { name: campaign.name, targetAmount: target.toFixed(2) },
  }).catch(() => {})

  notifyCircleMembers(circleId, userId, {
    type: "GROCERY_CAMPAIGN_CREATED",
    title: "New grocery campaign",
    message: `A grocery campaign "${campaign.name}" has been created.`,
    link: `/circles/${circleId}/grocery`,
  }).catch(() => {})

  return campaign
}

// Lifecycle transition guard matrix for campaign statuses.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PURCHASING", "CLOSED"],
  PURCHASING: ["DISTRIBUTING", "ACTIVE", "CLOSED"],
  DISTRIBUTING: ["CLOSED"],
  CLOSED: [],
}

export async function updateCampaign(
  circleId: string,
  campaignId: string,
  userId: string,
  data: {
    name?: string
    description?: string
    targetAmount?: number
    contributionStart?: string
    contributionEnd?: string
    distributionDate?: string
    estimatedCost?: number
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_MANAGE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns are immutable except through audited correction")

  const updated = await prisma.groceryCampaign.update({
    where: { id: campaignId },
    data: {
      ...(data.name != null ? { name: data.name.trim() } : {}),
      ...(data.description != null ? { description: data.description } : {}),
      ...(data.targetAmount != null ? { targetAmount: new Prisma.Decimal(data.targetAmount) } : {}),
      ...(data.contributionStart != null ? { contributionStart: new Date(data.contributionStart) } : {}),
      ...(data.contributionEnd != null ? { contributionEnd: new Date(data.contributionEnd) } : {}),
      ...(data.distributionDate != null ? { distributionDate: new Date(data.distributionDate) } : {}),
      ...(data.estimatedCost != null ? { estimatedCost: new Prisma.Decimal(data.estimatedCost) } : {}),
    },
  })

  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_CAMPAIGN_UPDATED",
    entityType: "GroceryCampaign",
    entityId: campaignId,
    newValues: data as Record<string, unknown>,
  }).catch(() => {})
  return updated
}

export async function setCampaignStatus(
  circleId: string,
  campaignId: string,
  userId: string,
  status: "DRAFT" | "ACTIVE" | "PURCHASING" | "DISTRIBUTING" | "CLOSED"
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_MANAGE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns cannot change status")

  const allowed = STATUS_TRANSITIONS[campaign.status] ?? []
  if (!allowed.includes(status)) throw new Error(`Cannot transition campaign from ${campaign.status} to ${status}`)

  const updated = await prisma.groceryCampaign.update({
    where: { id: campaignId },
    data: { status },
  })
  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_CAMPAIGN_STATUS",
    entityType: "GroceryCampaign",
    entityId: campaignId,
    oldValues: { status: campaign.status },
    newValues: { status },
  }).catch(() => {})
  return updated
}

// ─── Shopping List ────────────────────────────────────────

export async function addListItem(
  circleId: string,
  campaignId: string,
  userId: string,
  data: {
    product: string
    category?: string
    quantity?: number
    unit?: string
    estimatedPrice?: number
    notes?: string
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_LIST_MANAGE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns are immutable")
  if (!data.product?.trim()) throw new Error("Product is required")

  const item = await prisma.groceryListItem.create({
    data: {
      campaignId,
      product: data.product.trim(),
      category: data.category ?? null,
      quantity: data.quantity != null ? new Prisma.Decimal(data.quantity) : new Prisma.Decimal(1),
      unit: data.unit ?? null,
      estimatedPrice: data.estimatedPrice != null ? new Prisma.Decimal(data.estimatedPrice) : new Prisma.Decimal(0),
      notes: data.notes ?? null,
      createdById: userId,
    },
  })
  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_LIST_ITEM_ADDED",
    entityType: "GroceryListItem",
    entityId: item.id,
    newValues: { product: item.product, campaignId },
  }).catch(() => {})
  return item
}

export async function updateListItem(circleId: string, itemId: string, userId: string, data: {
  product?: string
  category?: string
  quantity?: number
  unit?: string
  estimatedPrice?: number
  notes?: string
}) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_LIST_MANAGE })
  const item = await prisma.groceryListItem.findFirst({ where: { id: itemId, grocery: { circleId } } })
  if (!item) throw new Error("List item not found")
  const updated = await prisma.groceryListItem.update({
    where: { id: itemId },
    data: {
      ...(data.product != null ? { product: data.product.trim() } : {}),
      ...(data.category != null ? { category: data.category } : {}),
      ...(data.quantity != null ? { quantity: new Prisma.Decimal(data.quantity) } : {}),
      ...(data.unit != null ? { unit: data.unit } : {}),
      ...(data.estimatedPrice != null ? { estimatedPrice: new Prisma.Decimal(data.estimatedPrice) } : {}),
      ...(data.notes != null ? { notes: data.notes } : {}),
    },
  })
  createAuditLog({ userId, circleId, action: "GROCERY_LIST_ITEM_UPDATED", entityType: "GroceryListItem", entityId: itemId, newValues: data as Record<string, unknown> }).catch(() => {})
  return updated
}

export async function removeListItem(circleId: string, itemId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_LIST_MANAGE })
  const item = await prisma.groceryListItem.findFirst({ where: { id: itemId, grocery: { circleId } } })
  if (!item) throw new Error("List item not found")
  await prisma.groceryListItem.delete({ where: { id: itemId } })
  createAuditLog({ userId, circleId, action: "GROCERY_LIST_ITEM_REMOVED", entityType: "GroceryListItem", entityId: itemId }).catch(() => {})
  return { ok: true }
}

// ─── Supplier Quotes ──────────────────────────────────────

export async function addSupplierQuote(
  circleId: string,
  campaignId: string,
  userId: string,
  data: {
    supplier: string
    quoteAmount: number
    quoteDocUrl?: string
    quoteDocFilename?: string
    notes?: string
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_QUOTE_CREATE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns are immutable")
  if (!data.supplier?.trim()) throw new Error("Supplier is required")
  if (dec(data.quoteAmount).lte(0)) throw new Error("Quote amount must be greater than zero")

  const quote = await prisma.grocerySupplierQuote.create({
    data: {
      campaignId,
      supplier: data.supplier.trim(),
      quoteAmount: new Prisma.Decimal(data.quoteAmount),
      quoteDocUrl: data.quoteDocUrl ?? null,
      quoteDocFilename: data.quoteDocFilename ?? null,
      notes: data.notes ?? null,
      status: "PENDING",
      createdById: userId,
    },
  })
  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_QUOTE_ADDED",
    entityType: "GrocerySupplierQuote",
    entityId: quote.id,
    newValues: { supplier: quote.supplier, quoteAmount: dec(quote.quoteAmount).toFixed(2), campaignId },
  }).catch(() => {})
  return quote
}

export async function approveSupplierQuote(circleId: string, quoteId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_QUOTE_APPROVE })
  const quote = await prisma.grocerySupplierQuote.findFirst({ where: { id: quoteId, grocery: { circleId } } })
  if (!quote) throw new Error("Quote not found")
  const campaign = await getCampaignOrThrow(circleId, quote.campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns are immutable")

  return prisma.$transaction(async (tx) => {
    // Reject all other quotes for the same campaign.
    await tx.grocerySupplierQuote.updateMany({
      where: { campaignId: quote.campaignId, id: { not: quoteId }, status: { not: "REJECTED" } },
      data: { status: "REJECTED" },
    })
    const approved = await tx.grocerySupplierQuote.update({
      where: { id: quoteId },
      data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    })
    await tx.groceryCampaign.update({
      where: { id: quote.campaignId },
      data: { approvedQuoteId: quoteId, status: "PURCHASING" },
    })
    createAuditLog({
      userId,
      circleId,
      action: "GROCERY_SUPPLIER_APPROVED",
      entityType: "GrocerySupplierQuote",
      entityId: quoteId,
      newValues: { supplier: approved.supplier, quoteAmount: dec(approved.quoteAmount).toFixed(2) },
    }).catch(() => {})
    notifyCircleMembers(circleId, userId, {
      type: "GROCERY_SUPPLIER_APPROVED",
      title: "Supplier approved",
      message: `Supplier "${approved.supplier}" was approved for grocery campaign "${campaign.name}".`,
      link: `/circles/${circleId}/grocery`,
    }).catch(() => {})
    return approved
  })
}

// ─── Purchase ─────────────────────────────────────────────

export async function recordPurchase(
  circleId: string,
  campaignId: string,
  userId: string,
  data: {
    supplier?: string
    purchaseAmount: number
    purchaseDate?: string
    paymentReference?: string
    receiptUrl?: string
    receiptFilename?: string
  }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_PURCHASE_MANAGE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns are immutable")
  if (dec(data.purchaseAmount).lte(0)) throw new Error("Purchase amount must be greater than zero")

  return prisma.$transaction(async (tx) => {
    const existing = await tx.groceryPurchase.findUnique({ where: { campaignId } })
    // Duplicate financial posting is prevented: a single purchase row per campaign.
    if (existing) {
      if (existing.status === "CONFIRMED") throw new Error("This purchase is confirmed and cannot be replaced")
      // Allow replacing an unconfirmed purchase record with an updated amount/receipt.
      const updated = await tx.groceryPurchase.update({
        where: { id: existing.id },
        data: {
          supplier: data.supplier ?? existing.supplier,
          purchaseAmount: new Prisma.Decimal(data.purchaseAmount),
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : existing.purchaseDate,
          paymentReference: data.paymentReference ?? existing.paymentReference,
          receiptUrl: data.receiptUrl ?? existing.receiptUrl,
          receiptFilename: data.receiptFilename ?? existing.receiptFilename,
          status: "RECEIPT_SUBMITTED",
        },
      })
      createAuditLog({
        userId,
        circleId,
        action: "GROCERY_PURCHASE_UPDATED",
        entityType: "GroceryPurchase",
        entityId: updated.id,
        oldValues: { purchaseAmount: dec(existing.purchaseAmount).toFixed(2) },
        newValues: { purchaseAmount: dec(updated.purchaseAmount).toFixed(2), supplier: updated.supplier },
      }).catch(() => {})
      return updated
    }

    const purchase = await tx.groceryPurchase.create({
      data: {
        campaignId,
        supplier: data.supplier ?? "Unknown supplier",
        purchaseAmount: new Prisma.Decimal(data.purchaseAmount),
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
        paymentReference: data.paymentReference ?? null,
        receiptUrl: data.receiptUrl ?? null,
        receiptFilename: data.receiptFilename ?? null,
        status: data.receiptUrl ? "RECEIPT_SUBMITTED" : "RECORDED",
        recordedById: userId,
      },
    })
    await tx.groceryCampaign.update({ where: { id: campaignId }, data: { status: "DISTRIBUTING" } })
    createAuditLog({
      userId,
      circleId,
      action: "GROCERY_PURCHASE_RECORDED",
      entityType: "GroceryPurchase",
      entityId: purchase.id,
      newValues: { purchaseAmount: dec(purchase.purchaseAmount).toFixed(2), supplier: purchase.supplier },
    }).catch(() => {})
    notifyCircleMembers(circleId, userId, {
      type: "GROCERY_PURCHASE_RECORDED",
      title: "Grocery purchased",
      message: `Grocery purchases for "${campaign.name}" have been recorded.`,
      link: `/circles/${circleId}/grocery`,
    }).catch(() => {})
    return purchase
  })
}

export async function confirmPurchase(circleId: string, campaignId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_PURCHASE_MANAGE })
  await getCampaignOrThrow(circleId, campaignId)
  const purchase = await prisma.groceryPurchase.findUnique({ where: { campaignId } })
  if (!purchase) throw new Error("No purchase recorded yet")

  const updated = await prisma.groceryPurchase.update({
    where: { id: purchase.id },
    data: { status: "CONFIRMED", confirmedById: userId, confirmedAt: new Date() },
  })
  createAuditLog({ userId, circleId, action: "GROCERY_PURCHASE_CONFIRMED", entityType: "GroceryPurchase", entityId: purchase.id }).catch(() => {})
  return updated
}

// ─── Member Allocations ───────────────────────────────────

export async function createAllocation(
  circleId: string,
  campaignId: string,
  userId: string,
  data: { memberId: string; items: string; value: number }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_ALLOCATION_MANAGE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns are immutable")
  const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: data.memberId } } })
  if (!member) throw new Error("Allocation target is not a member of this circle")
  if (!data.items?.trim()) throw new Error("Allocation items are required")

  const allocation = await prisma.groceryAllocation.create({
    data: {
      campaignId,
      memberId: data.memberId,
      items: data.items,
      value: new Prisma.Decimal(data.value),
      status: "PENDING",
      allocatedById: userId,
    },
  })
  createAuditLog({
    userId,
    circleId,
    affectedUserId: data.memberId,
    action: "GROCERY_ALLOCATION_CREATED",
    entityType: "GroceryAllocation",
    entityId: allocation.id,
    newValues: { value: dec(allocation.value).toFixed(2), items: data.items },
  }).catch(() => {})
  createNotification({
    userId: data.memberId,
    circleId,
    type: "GROCERY_ALLOCATION_CREATED",
    title: "Your grocery allocation is ready",
    message: `Goods have been allocated to you for "${campaign.name}".`,
    link: `/circles/${circleId}/grocery`,
  }).catch(() => {})
  return allocation
}

export async function confirmAllocation(circleId: string, allocationId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_COLLECTION_CONFIRM_OWN })
  const allocation = await prisma.groceryAllocation.findFirst({ where: { id: allocationId, grocery: { circleId } } })
  if (!allocation) throw new Error("Allocation not found")
  // Members may only confirm their own allocation.
  if (allocation.memberId !== userId) throw new Error("You can only confirm your own allocation")

  const updated = await prisma.groceryAllocation.update({
    where: { id: allocationId },
    data: { status: "CONFIRMED", confirmedAt: new Date(), issueNote: null },
  })
  createAuditLog({
    userId,
    circleId,
    affectedUserId: userId,
    action: "GROCERY_ALLOCATION_CONFIRMED",
    entityType: "GroceryAllocation",
    entityId: allocationId,
  }).catch(() => {})
  return updated
}

export async function reportAllocationIssue(circleId: string, allocationId: string, userId: string, note: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_COLLECTION_CONFIRM_OWN })
  const allocation = await prisma.groceryAllocation.findFirst({ where: { id: allocationId, grocery: { circleId } } })
  if (!allocation) throw new Error("Allocation not found")
  if (allocation.memberId !== userId) throw new Error("You can only report issues on your own allocation")
  if (!note?.trim()) throw new Error("An issue description is required")

  const updated = await prisma.groceryAllocation.update({
    where: { id: allocationId },
    data: { status: "ISSUE_REPORTED", confirmedAt: null, issueNote: note.trim() },
  })
  createAuditLog({
    userId,
    circleId,
    affectedUserId: userId,
    action: "GROCERY_ALLOCATION_ISSUE_REPORTED",
    entityType: "GroceryAllocation",
    entityId: allocationId,
    newValues: { issueNote: note.trim() },
  }).catch(() => {})
  return updated
}

// ─── Expenses ─────────────────────────────────────────────

export async function addExpense(
  circleId: string,
  campaignId: string,
  userId: string,
  data: { title: string; amount: number; date?: string; category?: string; receiptUrl?: string; receiptFilename?: string }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_PURCHASE_MANAGE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns are immutable")
  if (!data.title?.trim()) throw new Error("Expense title is required")
  if (dec(data.amount).lte(0)) throw new Error("Expense amount must be greater than zero")

  const expense = await prisma.groceryExpense.create({
    data: {
      campaignId,
      title: data.title.trim(),
      amount: new Prisma.Decimal(data.amount),
      date: data.date ? new Date(data.date) : new Date(),
      category: data.category ?? null,
      receiptUrl: data.receiptUrl ?? null,
      receiptFilename: data.receiptFilename ?? null,
      createdById: userId,
    },
  })
  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_EXPENSE_ADDED",
    entityType: "GroceryExpense",
    entityId: expense.id,
    newValues: { title: expense.title, amount: dec(expense.amount).toFixed(2) },
  }).catch(() => {})
  return expense
}

// ─── Campaign Contributions (reuse existing Contribution) ─

export async function addCampaignContribution(
  circleId: string,
  campaignId: string,
  userId: string,
  data: { memberId?: string; amount: number; note?: string }
) {
  await requireMember(circleId, userId)
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Finalized campaigns are immutable")
  if (dec(data.amount).lte(0)) throw new Error("Contribution amount must be greater than zero")

  const targetMemberId = data.memberId ?? userId
  const contributingSelf = targetMemberId === userId

  if (contributingSelf) {
    await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_SUBMIT_OWN })
  } else {
    await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.CONTRIBUTION_CREATE })
    const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: targetMemberId } } })
    if (!member) throw new Error("Target member is not part of this circle")
  }

  const contribution = await prisma.contribution.create({
    data: {
      circleId,
      userId: targetMemberId,
      createdById: userId,
      groceryCampaignId: campaignId,
      amount: new Prisma.Decimal(data.amount),
      status: "PAID",
      note: data.note ?? null,
    },
  })
  createAuditLog({
    userId,
    circleId,
    affectedUserId: targetMemberId,
    action: "GROCERY_CONTRIBUTION_ADDED",
    entityType: "Contribution",
    entityId: contribution.id,
    newValues: { amount: dec(contribution.amount).toFixed(2), campaignId },
  }).catch(() => {})
  return contribution
}

// ─── Read APIs ────────────────────────────────────────────

export async function listCampaigns(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_VIEW_OWN })
  const campaigns = await prisma.groceryCampaign.findMany({
    where: { circleId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { allocations: true, listItems: true, supplierQuotes: true } },
      purchase: true,
      contributions: { where: { status: { in: [...CONTRIB_SUCCESS] } } },
    },
  })

  return campaigns.map((c) => {
    const collected = c.contributions.reduce((s, x) => s + toNumber(x.amount), 0)
    const paidMembers = new Set(c.contributions.map((x) => x.userId))
    const totalMembers = c._count.allocations > 0 ? c._count.allocations : 0
    return {
      id: c.id,
      name: c.name,
      targetAmount: dec(c.targetAmount).toFixed(2),
      estimatedCost: dec(c.estimatedCost).toFixed(2),
      status: c.status,
      distributionDate: c.distributionDate ? c.distributionDate.toISOString() : null,
      contributionEnd: c.contributionEnd ? c.contributionEnd.toISOString() : null,
      isFinalized: c.isFinalized,
      amountCollected: collected.toFixed(2),
      targetPercent: dec(c.targetAmount).gt(0) ? Math.round((collected / toNumber(c.targetAmount)) * 100) : 0,
      membersPaid: paidMembers.size,
      membersOutstanding: Math.max(0, totalMembers - paidMembers.size),
      listItemCount: c._count.listItems,
      quoteCount: c._count.supplierQuotes,
      allocationCount: c._count.allocations,
      approvedSupplier: c.purchase?.supplier ?? null,
      createdAt: c.createdAt,
    }
  })
}

// Whether the caller may view all members' allocation values & governance financials.
async function canViewAllGrocery(circleId: string, userId: string): Promise<boolean> {
  return (
    (await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_VIEW_ALL })) ||
    (await hasCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_MANAGE }))
  )
}

export async function getCampaign(circleId: string, campaignId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_VIEW_OWN })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  const viewAll = await canViewAllGrocery(circleId, userId)

  const [listItems, supplierQuotes, purchase, allocations, expenses, myContributions] = await Promise.all([
    prisma.groceryListItem.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } }),
    prisma.grocerySupplierQuote.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" }, include: { approvedBy: { select: { name: true } } } }),
    prisma.groceryPurchase.findUnique({ where: { campaignId } }),
    prisma.groceryAllocation.findMany({ where: { campaignId }, include: { member: { select: { id: true, name: true, email: true } } } }),
    prisma.groceryExpense.findMany({ where: { campaignId }, orderBy: { date: "asc" } }),
    prisma.contribution.findMany({ where: { circleId, userId, groceryCampaignId: campaignId, status: { in: [...CONTRIB_SUCCESS] } }, orderBy: { createdAt: "desc" } }),
  ])

  const allMembers = await prisma.circleMember.findMany({
    where: { circleId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  })

  const allContributions = await prisma.contribution.findMany({
    where: { circleId, groceryCampaignId: campaignId, status: { in: [...CONTRIB_SUCCESS] } },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  const collected = allContributions.reduce((s, x) => s + toNumber(x.amount), 0)
  const paidMemberIds = new Set(allContributions.map((x) => x.userId))

  const totalMembers = await prisma.circleMember.count({ where: { circleId } })

  const approvedQuote = supplierQuotes.find((q) => q.id === campaign.approvedQuoteId) ?? supplierQuotes.find((q) => q.status === "APPROVED") ?? null
  const otherExpenses = expenses.reduce((s, x) => s + toNumber(x.amount), 0)
  const purchaseCost = purchase ? toNumber(purchase.purchaseAmount) : 0
  const remaining = collected - purchaseCost - otherExpenses
  const savings = campaign.estimatedCost ? toNumber(campaign.estimatedCost) - purchaseCost : null

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    targetAmount: dec(campaign.targetAmount).toFixed(2),
    estimatedCost: dec(campaign.estimatedCost).toFixed(2),
    status: campaign.status,
    contributionStart: campaign.contributionStart ? campaign.contributionStart.toISOString() : null,
    contributionEnd: campaign.contributionEnd ? campaign.contributionEnd.toISOString() : null,
    distributionDate: campaign.distributionDate ? campaign.distributionDate.toISOString() : null,
    isFinalized: campaign.isFinalized,
    finalizedAt: campaign.finalizedAt ? campaign.finalizedAt.toISOString() : null,
    canViewAny: viewAll,
    amountCollected: collected.toFixed(2),
    targetPercent: dec(campaign.targetAmount).gt(0) ? Math.round((collected / toNumber(campaign.targetAmount)) * 100) : 0,
    membersPaid: paidMemberIds.size,
    membersOutstanding: Math.max(0, totalMembers - paidMemberIds.size),
    collectionProgress: totalMembers > 0 ? Math.round((paidMemberIds.size / totalMembers) * 100) : 0,
    purchaseCost: purchaseCost.toFixed(2),
    otherExpenses: otherExpenses.toFixed(2),
    remainingBalance: remaining.toFixed(2),
    savings: savings != null ? savings.toFixed(2) : null,
    approvedQuote: approvedQuote
      ? {
          id: approvedQuote.id,
          supplier: approvedQuote.supplier,
          quoteAmount: dec(approvedQuote.quoteAmount).toFixed(2),
          status: approvedQuote.status,
        }
      : null,
    listItems: listItems.map((i) => ({
      id: i.id,
      product: i.product,
      category: i.category,
      quantity: dec(i.quantity).toNumber(),
      unit: i.unit,
      estimatedPrice: dec(i.estimatedPrice).toFixed(2),
      notes: i.notes,
    })),
    supplierQuotes: supplierQuotes.map((q) => ({
      id: q.id,
      supplier: q.supplier,
      quoteAmount: dec(q.quoteAmount).toFixed(2),
      quoteDocUrl: q.quoteDocUrl,
      quoteDocFilename: q.quoteDocFilename,
      notes: q.notes,
      status: q.status,
      approvedByName: q.approvedBy?.name ?? null,
      approvedAt: q.approvedAt ? q.approvedAt.toISOString() : null,
    })),
    purchase: purchase
      ? {
          id: purchase.id,
          supplier: purchase.supplier,
          purchaseAmount: dec(purchase.purchaseAmount).toFixed(2),
          purchaseDate: purchase.purchaseDate ? purchase.purchaseDate.toISOString() : null,
          paymentReference: purchase.paymentReference,
          receiptUrl: purchase.receiptUrl,
          receiptFilename: purchase.receiptFilename,
          status: purchase.status,
        }
      : null,
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: dec(e.amount).toFixed(2),
      date: e.date.toISOString(),
      category: e.category,
      receiptUrl: e.receiptUrl,
      receiptFilename: e.receiptFilename,
    })),
    contributions: viewAll
      ? allContributions.map((x) => ({ id: x.id, memberId: x.userId, memberName: x.user.name || x.user.email, amount: dec(x.amount).toFixed(2), note: x.note, createdAt: x.createdAt }))
      : undefined,
    myContributions: myContributions.map((x) => ({ id: x.id, amount: dec(x.amount).toFixed(2), note: x.note, createdAt: x.createdAt })),
    allocations: allocations.map((a) => ({
      id: a.id,
      memberId: a.memberId,
      memberName: a.member.name,
      items: a.items,
      value: dec(a.value).toFixed(2),
      status: a.status,
      confirmedAt: a.confirmedAt ? a.confirmedAt.toISOString() : null,
      issueNote: a.issueNote,
      showValue: viewAll || a.memberId === userId,
    })),
    myAllocation: allocations.find((a) => a.memberId === userId) ?? null,
    members: allMembers
      .filter((m) => viewAll || m.userId === userId)
      .map((m) => ({ id: m.userId, name: m.user.name || m.user.email })),
  }
}

export async function getGroceryDashboard(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_VIEW_OWN })
  const config = await prisma.circleGroceryConfig.findUnique({ where: { circleId } })
  const campaigns = await prisma.groceryCampaign.findMany({
    where: { circleId },
    orderBy: { createdAt: "desc" },
    include: {
      purchase: true,
      contributions: { where: { status: { in: [...CONTRIB_SUCCESS] } } },
    },
  })

  const active = campaigns.find((c) => ["ACTIVE", "PURCHASING", "DISTRIBUTING"].includes(c.status)) ?? campaigns[0] ?? null

  let block: GroceryDashboardBlock | null = null
  if (active) {
    const collected = active.contributions.reduce((s, x) => s + toNumber(x.amount), 0)
    const paidMembers = new Set(active.contributions.map((x) => x.userId))
    const totalMembers = await prisma.circleMember.count({ where: { circleId } })
    const estimatedCost = toNumber(active.estimatedCost)
    const purchaseCost = active.purchase ? toNumber(active.purchase.purchaseAmount) : 0
    const savings = estimatedCost > 0 ? estimatedCost - purchaseCost : null
    block = {
      id: active.id,
      name: active.name,
      status: active.status,
      targetAmount: toNumber(active.targetAmount),
      amountCollected: collected,
      targetPercent: dec(active.targetAmount).gt(0) ? Math.round((collected / toNumber(active.targetAmount)) * 100) : 0,
      membersPaid: paidMembers.size,
      membersOutstanding: Math.max(0, totalMembers - paidMembers.size),
      collectionProgress: totalMembers > 0 ? Math.round((paidMembers.size / totalMembers) * 100) : 0,
      selectedSupplier: active.purchase?.supplier ?? null,
      estimatedCost: estimatedCost,
      estimatedSavings: savings,
      distributionDate: active.distributionDate ? active.distributionDate.toISOString() : null,
      isFinalized: active.isFinalized,
    }
  }

  return {
    enabled: config?.enabled ?? false,
    campaignCount: campaigns.length,
    active,
    block,
    recent: campaigns.slice(0, 5).map((c) => ({ id: c.id, name: c.name, status: c.status, isFinalized: c.isFinalized })),
  }
}

export interface GroceryDashboardBlock {
  id: string
  name: string
  status: string
  targetAmount: number
  amountCollected: number
  targetPercent: number
  membersPaid: number
  membersOutstanding: number
  collectionProgress: number
  selectedSupplier: string | null
  estimatedCost: number
  estimatedSavings: number | null
  distributionDate: string | null
  isFinalized: boolean
}

// ─── Reconciliation & Close ───────────────────────────────

interface ReconciliationResult {
  contributionsCollected: string
  purchaseCost: string
  otherExpenses: string
  remainingBalance: string
  savingsVsEstimated: string | null
  perMemberAllocationValue: { memberId: string; memberName: string; value: string; status: string }[]
  collectionProgress: number
}

async function computeReconciliation(circleId: string, campaignId: string): Promise<ReconciliationResult> {
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  const [contributions, purchase, expenses, allocations, members] = await Promise.all([
    prisma.contribution.findMany({ where: { circleId, groceryCampaignId: campaignId, status: { in: [...CONTRIB_SUCCESS] } } }),
    prisma.groceryPurchase.findUnique({ where: { campaignId } }),
    prisma.groceryExpense.findMany({ where: { campaignId } }),
    prisma.groceryAllocation.findMany({ where: { campaignId }, include: { member: { select: { name: true } } } }),
    prisma.circleMember.findMany({ where: { circleId }, include: { user: { select: { name: true } } } }),
  ])

  const contributionsCollected = contributions.reduce((s, x) => s + toNumber(x.amount), 0)
  const purchaseCost = purchase ? toNumber(purchase.purchaseAmount) : 0
  const otherExpenses = expenses.reduce((s, x) => s + toNumber(x.amount), 0)
  const remainingBalance = contributionsCollected - purchaseCost - otherExpenses
  const estimated = toNumber(campaign.estimatedCost)
  const savingsVsEstimated = estimated > 0 ? estimated - purchaseCost : null

  const memberMap = new Map(members.map((m) => [m.userId, m.user.name]))
  const paidMemberIds = new Set(contributions.map((x) => x.userId))
  const perMemberAllocationValue = allocations.map((a) => ({
    memberId: a.memberId,
    memberName: a.member.name || memberMap.get(a.memberId) || a.memberId,
    value: dec(a.value).toFixed(2),
    status: a.status,
  }))
  const collectionProgress = members.length > 0 ? Math.round((paidMemberIds.size / members.length) * 100) : 0

  return {
    contributionsCollected: contributionsCollected.toFixed(2),
    purchaseCost: purchaseCost.toFixed(2),
    otherExpenses: otherExpenses.toFixed(2),
    remainingBalance: remainingBalance.toFixed(2),
    savingsVsEstimated: savingsVsEstimated != null ? savingsVsEstimated.toFixed(2) : null,
    perMemberAllocationValue,
    collectionProgress,
  }
}

export async function reconcileCampaign(circleId: string, campaignId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_RECONCILE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Campaign is already finalized")

  const result = await computeReconciliation(circleId, campaignId)
  const updated = await prisma.groceryCampaign.update({
    where: { id: campaignId },
    data: {
      reconContributions: new Prisma.Decimal(result.contributionsCollected),
      reconPurchaseCost: new Prisma.Decimal(result.purchaseCost),
      reconOtherExpenses: new Prisma.Decimal(result.otherExpenses),
      reconRemainingBalance: new Prisma.Decimal(result.remainingBalance),
      reconSavings: new Prisma.Decimal(result.savingsVsEstimated ?? 0),
      reconSnapshot: JSON.stringify(result),
    },
  })
  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_RECONCILED",
    entityType: "GroceryCampaign",
    entityId: campaignId,
    newValues: result as unknown as Record<string, unknown>,
  }).catch(() => {})
  return { ...result, snapshot: updated.reconSnapshot }
}

export async function closeCampaign(circleId: string, campaignId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_RECONCILE })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (campaign.isFinalized) throw new Error("Campaign is already finalized")
  if (campaign.status !== "DISTRIBUTING" && campaign.status !== "ACTIVE" && campaign.status !== "PURCHASING") {
    throw new Error(`Only an active, purchasing or distributing campaign can be closed (status: ${campaign.status})`)
  }

  const result = await computeReconciliation(circleId, campaignId)
  const updated = await prisma.groceryCampaign.update({
    where: { id: campaignId },
    data: {
      status: "CLOSED",
      isFinalized: true,
      finalizedAt: new Date(),
      finalizedById: userId,
      reconContributions: new Prisma.Decimal(result.contributionsCollected),
      reconPurchaseCost: new Prisma.Decimal(result.purchaseCost),
      reconOtherExpenses: new Prisma.Decimal(result.otherExpenses),
      reconRemainingBalance: new Prisma.Decimal(result.remainingBalance),
      reconSavings: new Prisma.Decimal(result.savingsVsEstimated ?? 0),
      reconSnapshot: JSON.stringify(result),
    },
  })
  createAuditLog({
    userId,
    circleId,
    action: "GROCERY_CAMPAIGN_CLOSED",
    entityType: "GroceryCampaign",
    entityId: campaignId,
    newValues: { ...result, status: "CLOSED" } as unknown as Record<string, unknown>,
  }).catch(() => {})
  notifyCircleMembers(circleId, userId, {
    type: "GROCERY_CAMPAIGN_CLOSED",
    title: "Grocery campaign closed",
    message: `Grocery campaign "${campaign.name}" has been finalized.`,
    link: `/circles/${circleId}/grocery`,
  }).catch(() => {})
  return { ...result, id: updated.id, status: updated.status, isFinalized: true }
}

export async function correctCampaign(
  circleId: string,
  campaignId: string,
  userId: string,
  data: { note: string; remainingBalanceDelta?: number; reopen?: boolean }
) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.GROCERY_CORRECT })
  const campaign = await getCampaignOrThrow(circleId, campaignId)
  if (!campaign.isFinalized) throw new Error("Only finalized campaigns can be corrected")
  if (!data.note?.trim()) throw new Error("A correction note is required")

  return prisma.$transaction(async (tx) => {
    let updated
    if (data.remainingBalanceDelta != null) {
      const delta = new Prisma.Decimal(data.remainingBalanceDelta)
      const newBalance = dec(campaign.reconRemainingBalance).add(delta)
      updated = await tx.groceryCampaign.update({
        where: { id: campaignId },
        data: { reconRemainingBalance: newBalance, updatedAt: new Date() },
      })
    } else if (data.reopen) {
      updated = await tx.groceryCampaign.update({
        where: { id: campaignId },
        data: { status: "ACTIVE", isFinalized: false, finalizedAt: null, finalizedById: null, updatedAt: new Date() },
      })
    } else {
      throw new Error("Provide a remaining balance delta or reopen flag to correct the campaign")
    }

    createAuditLog({
      userId,
      circleId,
      action: "GROCERY_CAMPAIGN_CORRECTED",
      entityType: "GroceryCampaign",
      entityId: campaignId,
      reason: data.note,
      oldValues: { reconRemainingBalance: dec(campaign.reconRemainingBalance).toFixed(2), isFinalized: campaign.isFinalized },
      newValues: data.reopen ? { isFinalized: false } : { reconRemainingBalance: dec(updated.reconRemainingBalance).toFixed(2) },
    }).catch(() => {})
    return updated
  })
}

