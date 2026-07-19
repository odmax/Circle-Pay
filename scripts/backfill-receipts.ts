import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const BATCH_SIZE = 50

function parseArgs(): { dryRun: boolean } {
  const dryRun = process.argv.includes("--dry-run")
  return { dryRun }
}

function generateVerificationToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let token = ""
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

async function getNextReceiptNumber(circleId: string): Promise<string> {
  const year = new Date().getFullYear()
  const seq = await prisma.receiptSequence.upsert({
    where: { circleId_year: { circleId, year } },
    create: { circleId, year, currentValue: 1 },
    update: { currentValue: { increment: 1 } },
  })
  const padded = String(seq.currentValue).padStart(6, "0")
  return `RCP-${year}-${padded}`
}

interface BackfillResult {
  skipped: number
  created: number
  failed: number
  errors: string[]
}

async function backfillContribution(
  contributionId: string,
  dryRun: boolean
): Promise<"created" | "skipped" | "failed"> {
  try {
    const existing = await prisma.financialReceipt.findFirst({
      where: {
        resourceId: contributionId,
        resourceType: "CONTRIBUTION",
      },
    })
    if (existing) return "skipped"

    const contribution = await prisma.contribution.findUnique({
      where: { id: contributionId },
      include: {
        circle: { select: { id: true, name: true, currency: true } },
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (!contribution) return "failed"

    if (dryRun) return "created"

    const receiptNumber = await getNextReceiptNumber(contribution.circleId)
    const verificationToken = generateVerificationToken()

    await prisma.financialReceipt.create({
      data: {
        circleId: contribution.circleId,
        type: "CONTRIBUTION",
        status: "ACTIVE",
        receiptNumber,
        resourceId: contribution.id,
        resourceType: "CONTRIBUTION",
        issuedToUserId: contribution.userId,
        issuedByUserId: contribution.createdById,
        amount: contribution.amount,
        currency: contribution.circle.currency,
        title: `Contribution — ${contribution.circle.name}`,
        description: contribution.note || null,
        paymentReference: null,
        transactionDate: contribution.paymentDate,
        verificationToken,
        issuedAt: contribution.createdAt,
      },
    })

    return "created"
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed contribution ${contributionId}: ${msg}`)
    return "failed"
  }
}

async function processBatch(
  contributionIds: string[],
  dryRun: boolean
): Promise<BackfillResult> {
  const result: BackfillResult = { skipped: 0, created: 0, failed: 0, errors: [] }

  for (const id of contributionIds) {
    const status = await backfillContribution(id, dryRun)
    result[status]++
  }

  return result
}

async function main() {
  const { dryRun } = parseArgs()

  console.log("=== Circle Pay Receipt Backfill ===")
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log("")

  const unconfirmedContributions = await prisma.contribution.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PENDING", "PENDING_REVIEW", "REJECTED", "CANCELLED", "OVERDUE"] },
    },
    select: { id: true },
  })
  console.log(`Skipping ${unconfirmedContributions.length} non-confirmed contributions.`)

  const contributionsWithReceipts = await prisma.financialReceipt.findMany({
    where: { resourceType: "CONTRIBUTION" },
    select: { resourceId: true },
  })
  const receiptResourceIds = new Set(contributionsWithReceipts.map((r) => r.resourceId))
  console.log(`${receiptResourceIds.size} contributions already have receipts.`)

  const candidates = await prisma.contribution.findMany({
    where: {
      deletedAt: null,
      status: { in: ["CONFIRMED", "PAID"] },
      id: { notIn: Array.from(receiptResourceIds) },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  console.log(`${candidates.length} contributions to process.`)
  console.log("")

  if (candidates.length === 0) {
    console.log("Nothing to backfill. Exiting.")
    await prisma.$disconnect()
    return
  }

  const totals: BackfillResult = { skipped: 0, created: 0, failed: 0, errors: [] }
  const batches = Math.ceil(candidates.length / BATCH_SIZE)

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, candidates.length)
    const batchIds = candidates.slice(start, end).map((c) => c.id)

    console.log(`Batch ${i + 1}/${batches} — processing ${batchIds.length} items...`)
    const batchResult = await processBatch(batchIds, dryRun)

    totals.skipped += batchResult.skipped
    totals.created += batchResult.created
    totals.failed += batchResult.failed
    totals.errors.push(...batchResult.errors)
  }

  console.log("")
  console.log("=== Backfill Complete ===")
  console.log(`  Skipped (already had receipt): ${totals.skipped}`)
  console.log(`  Created: ${totals.created}`)
  console.log(`  Failed:  ${totals.failed}`)

  if (totals.errors.length > 0) {
    console.log("")
    console.log("Errors:")
    for (const err of totals.errors) {
      console.log(`  - ${err}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("Backfill script failed:", err)
  await prisma.$disconnect()
  process.exit(1)
})
