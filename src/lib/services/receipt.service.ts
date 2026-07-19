import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { createNotification } from "@/lib/services/notification.service"
import { APP_URL } from "@/lib/constants"
import type { ReceiptType, ReceiptStatus } from "@/generated/prisma"

// ─── Helpers ───────────────────────────────────────────

function getCircleCode(circleName: string): string {
  return circleName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 10)
    .toUpperCase()
}

// ─── Receipt Numbering ─────────────────────────────────

export async function generateReceiptNumber(
  circleId: string,
  circleCode: string
): Promise<string> {
  const year = new Date().getFullYear()
  const sequence = await prisma.$transaction(async (tx) => {
    const record = await tx.receiptSequence.upsert({
      where: { circleId_year: { circleId, year } },
      create: { circleId, year, currentValue: 1 },
      update: { currentValue: { increment: 1 } },
    })
    return record.currentValue
  })
  const padded = String(sequence).padStart(6, "0")
  return `CP-${year}-${circleCode}-${padded}`
}

// ─── Create Receipt ────────────────────────────────────

export async function createReceiptForContribution(data: {
  circleId: string
  contributionId: string
  ledgerEntryId: string
  circleName: string
  circleCode: string
  payerUserId: string
  payerName: string
  payerEmail: string
  amount: number
  currency: string
  paymentDate: Date
  approvalDate?: Date | null
  planName?: string | null
  approverNames?: string | null
  issuedByUserId: string
}) {
  const receiptNumber = await generateReceiptNumber(
    data.circleId,
    data.circleCode
  )
  const verificationToken = crypto.randomUUID()
  const now = new Date()

  const receipt = await prisma.financialReceipt.create({
    data: {
      circleId: data.circleId,
      type: "CONTRIBUTION" as ReceiptType,
      status: "ACTIVE" as ReceiptStatus,
      receiptNumber,
      resourceId: data.contributionId,
      resourceType: "CONTRIBUTION",
      ledgerEntryId: data.ledgerEntryId,
      issuedToUserId: data.payerUserId,
      issuedByUserId: data.issuedByUserId,
      amount: data.amount,
      currency: data.currency,
      title: `Contribution Receipt`,
      description: null,
      paymentReference: null,
      transactionDate: data.paymentDate,
      issuedAt: now,
      verificationToken,
      metadata: {
        circleName: data.circleName,
        circleCode: data.circleCode,
        payerName: data.payerName,
        payerEmail: data.payerEmail,
        approverNames: data.approverNames ?? null,
        planName: data.planName ?? null,
        paymentDate: data.paymentDate.toISOString(),
        approvalDate: data.approvalDate?.toISOString() ?? null,
      },
    },
  })

  await createAuditLog({
    userId: data.issuedByUserId,
    circleId: data.circleId,
    action: "RECEIPT_CREATED",
    entityType: "FinancialReceipt",
    entityId: receipt.id,
    newValues: { receiptNumber, type: "CONTRIBUTION", amount: data.amount, currency: data.currency },
  })

  await createNotification({
    userId: data.payerUserId,
    circleId: data.circleId,
    type: "RECEIPT_ISSUED",
    title: "Receipt Issued",
    message: `Your contribution receipt (${receiptNumber}) has been issued.`,
    link: `${APP_URL}/circles/${data.circleId}/receipts/${receipt.id}`,
  })

  return receipt
}

// ─── Query Functions ───────────────────────────────────

export async function getReceiptById(receiptId: string) {
  return prisma.financialReceipt.findUnique({
    where: { id: receiptId },
    include: {
      circle: { select: { id: true, name: true } },
      issuedTo: { select: { id: true, name: true, email: true, image: true } },
      issuedBy: { select: { id: true, name: true, email: true, image: true } },
      voidedBy: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function getReceiptByNumber(receiptNumber: string) {
  return prisma.financialReceipt.findUnique({
    where: { receiptNumber },
    include: {
      circle: { select: { id: true, name: true } },
      issuedTo: { select: { id: true, name: true, email: true, image: true } },
      issuedBy: { select: { id: true, name: true, email: true, image: true } },
      voidedBy: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function getReceiptByVerificationToken(token: string) {
  return prisma.financialReceipt.findUnique({
    where: { verificationToken: token },
    select: {
      receiptNumber: true,
      type: true,
      amount: true,
      currency: true,
      status: true,
      transactionDate: true,
      issuedAt: true,
      title: true,
      metadata: true,
    },
  })
}

export async function getReceiptForResource(resourceType: string, resourceId: string) {
  return prisma.financialReceipt.findFirst({
    where: { resourceType, resourceId },
    include: {
      circle: { select: { id: true, name: true } },
      issuedTo: { select: { id: true, name: true, email: true } },
      issuedBy: { select: { id: true, name: true, email: true } },
    },
  })
}

export async function getUserReceipts(userId: string, circleId?: string) {
  return prisma.financialReceipt.findMany({
    where: {
      issuedToUserId: userId,
      ...(circleId ? { circleId } : {}),
    },
    include: {
      circle: { select: { id: true, name: true } },
      issuedBy: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { issuedAt: "desc" },
  })
}

export async function getCircleReceipts(
  circleId: string,
  filters?: {
    type?: ReceiptType
    status?: ReceiptStatus
    search?: string
    limit?: number
    offset?: number
  }
) {
  const limit = filters?.limit ?? 25
  const offset = filters?.offset ?? 0

  const where: Record<string, unknown> = { circleId }
  if (filters?.type) where.type = filters.type
  if (filters?.status) where.status = filters.status
  if (filters?.search) {
    where.OR = [
      { receiptNumber: { contains: filters.search, mode: "insensitive" } },
      { title: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  const [receipts, total] = await Promise.all([
    prisma.financialReceipt.findMany({
      where: where as never,
      include: {
        issuedTo: { select: { id: true, name: true, email: true, image: true } },
        issuedBy: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.financialReceipt.count({ where: where as never }),
  ])

  return { receipts, total, limit, offset }
}

// ─── Void Receipt ──────────────────────────────────────

export async function voidReceipt(receiptId: string, userId: string, reason: string) {
  const receipt = await prisma.financialReceipt.findUnique({ where: { id: receiptId } })
  if (!receipt) throw new Error("Receipt not found")
  if (receipt.status !== "ACTIVE") throw new Error("Only active receipts can be voided")

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.financialReceipt.update({
      where: { id: receiptId },
      data: {
        status: "VOIDED",
        voidedAt: now,
        voidedByUserId: userId,
        voidReason: reason,
      },
    })

    await createAuditLog({
      userId,
      circleId: receipt.circleId,
      action: "RECEIPT_VOIDED",
      entityType: "FinancialReceipt",
      entityId: receiptId,
      oldValues: { status: "ACTIVE" },
      newValues: { status: "VOIDED", voidReason: reason },
    })

    return result
  })

  await createNotification({
    userId: receipt.issuedToUserId,
    circleId: receipt.circleId,
    type: "RECEIPT_VOIDED",
    title: "Receipt Voided",
    message: `Your receipt (${receipt.receiptNumber}) has been voided. Reason: ${reason}`,
    link: `${APP_URL}/circles/${receipt.circleId}/receipts/${receiptId}`,
  })

  return updated
}

// ─── Replace Receipt ───────────────────────────────────

export async function replaceReceipt(receiptId: string, userId: string, reason: string) {
  const receipt = await prisma.financialReceipt.findUnique({ where: { id: receiptId } })
  if (!receipt) throw new Error("Receipt not found")
  if (receipt.status !== "ACTIVE") throw new Error("Only active receipts can be replaced")

  const circleCode = (receipt.metadata as Record<string, unknown>)?.circleCode as string || "CIRCLE"
  const receiptNumber = await generateReceiptNumber(receipt.circleId, circleCode)
  const verificationToken = crypto.randomUUID()

  const newReceipt = await prisma.$transaction(async (tx) => {
    await tx.financialReceipt.update({
      where: { id: receiptId },
      data: { status: "REPLACED" },
    })

    return tx.financialReceipt.create({
      data: {
        circleId: receipt.circleId,
        type: receipt.type,
        status: "ACTIVE",
        receiptNumber,
        resourceId: receipt.resourceId,
        resourceType: receipt.resourceType,
        ledgerEntryId: receipt.ledgerEntryId,
        issuedToUserId: receipt.issuedToUserId,
        issuedByUserId: userId,
        amount: receipt.amount,
        currency: receipt.currency,
        title: receipt.title,
        description: receipt.description,
        paymentReference: receipt.paymentReference,
        transactionDate: receipt.transactionDate,
        issuedAt: new Date(),
        verificationToken,
        metadata: receipt.metadata as Record<string, unknown> as never,
        replacementReceiptId: receiptId,
      },
    })
  })

  await createAuditLog({
    userId,
    circleId: receipt.circleId,
    action: "RECEIPT_REPLACED",
    entityType: "FinancialReceipt",
    entityId: receiptId,
    oldValues: { receiptNumber: receipt.receiptNumber, status: "ACTIVE" },
    newValues: { receiptNumber: newReceipt.receiptNumber, replacementReason: reason },
  })

  await createNotification({
    userId: receipt.issuedToUserId,
    circleId: receipt.circleId,
    type: "RECEIPT_REPLACED",
    title: "Receipt Replaced",
    message: `Your receipt (${receipt.receiptNumber}) has been replaced with ${newReceipt.receiptNumber}. Reason: ${reason}`,
    link: `${APP_URL}/circles/${receipt.circleId}/receipts/${newReceipt.id}`,
  })

  return newReceipt
}

// ─── Verify Receipt ────────────────────────────────────

export async function verifyReceipt(token: string) {
  const receipt = await prisma.financialReceipt.findUnique({
    where: { verificationToken: token },
    select: {
      receiptNumber: true,
      type: true,
      amount: true,
      currency: true,
      status: true,
      transactionDate: true,
      issuedAt: true,
      metadata: true,
      voidReason: true,
    },
  })

  if (!receipt) return { valid: false as const }

  return {
    valid: true as const,
    receipt: {
      receiptNumber: receipt.receiptNumber,
      circleName: (receipt.metadata as Record<string, unknown>)?.circleName as string || "",
      type: receipt.type,
      amount: receipt.amount,
      currency: receipt.currency,
      transactionDate: receipt.transactionDate,
      issuedAt: receipt.issuedAt,
      status: receipt.status,
      voidReason: receipt.voidReason,
    },
  }
}

// ─── Stats ─────────────────────────────────────────────

export async function getReceiptStats(circleId: string) {
  const [statusCounts, amountSums] = await Promise.all([
    prisma.financialReceipt.groupBy({
      by: ["status"],
      where: { circleId },
      _count: { id: true },
    }),
    prisma.financialReceipt.aggregate({
      where: { circleId, status: "ACTIVE" },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ])

  const byStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.id])
  )

  return {
    totalReceipts: amountSums._count.id,
    totalAmount: Number(amountSums._sum.amount ?? 0),
    byStatus: {
      ACTIVE: byStatus["ACTIVE"] ?? 0,
      VOIDED: byStatus["VOIDED"] ?? 0,
      REPLACED: byStatus["REPLACED"] ?? 0,
    },
  }
}
