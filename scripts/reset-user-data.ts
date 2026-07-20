#!/usr/bin/env npx tsx
/**
 * Reset user data script.
 *
 * Usage:
 *   npx tsx scripts/reset-user-data.ts --email user@example.com --dry-run   (default)
 *   npx tsx scripts/reset-user-data.ts --email user@example.com --execute
 *   npx tsx scripts/reset-user-data.ts --email user@example.com --execute --delete-user
 *
 * - Defaults to dry-run (safe).
 * - Requires --execute to perform deletion.
 * - Pass --delete-user to also remove the auth account (not just data).
 * - Pass --delete-owned-circles to also delete circles owned by the user (even if shared).
 * - Email comparison is case-insensitive.
 * - Idempotent: safe to run multiple times.
 */

import { prisma } from "../src/lib/prisma"
import { normalizeEmail } from "../src/lib/email"

function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`)
}

async function main() {
  const rawArgs = process.argv.slice(2)

  const emailArg = getArg(rawArgs, "email")
  const dryRun = hasFlag(rawArgs, "dry-run") || !hasFlag(rawArgs, "execute")
  const deleteUser = hasFlag(rawArgs, "delete-user")
  const deleteOwnedCircles = hasFlag(rawArgs, "delete-owned-circles")

  if (!emailArg) {
    console.error("Error: --email is required.")
    console.error("  Usage: npx tsx scripts/reset-user-data.ts --email user@example.com --dry-run")
    process.exit(1)
  }

  const email = normalizeEmail(emailArg)
  if (!email) {
    console.error("Error: Invalid email.")
    process.exit(1)
  }

  console.log(`\nReset User Data Script`)
  console.log(`  Email:    ${email}`)
  console.log(`  Mode:     ${dryRun ? "DRY RUN (no changes)" : "EXECUTE (will modify database)"}`)
  console.log(`  Delete user: ${deleteUser ? "YES" : "NO (preserve auth account)"}`)
  console.log(`  Delete owned circles: ${deleteOwnedCircles ? "YES" : "NO (skip circles with other members)"}\n`)

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, createdAt: true },
  })

  if (!user) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }

  console.log(`User found: ${user.name || "(no name)"} <${user.email}> (id: ${user.id})\n`)

  // Count related data
  console.log("Related data counts:")

  const countQueries: [string, Promise<number>][] = [
    ["circles (owned)", prisma.circle.count({ where: { createdById: user.id } })],
    ["circleMembers", prisma.circleMember.count({ where: { userId: user.id } })],
    ["contributions (paid)", prisma.contribution.count({ where: { userId: user.id } })],
    ["contributions (recorded)", prisma.contribution.count({ where: { createdById: user.id } })],
    ["expenses (paid)", prisma.expense.count({ where: { paidById: user.id } })],
    ["expenses (created)", prisma.expense.count({ where: { createdById: user.id } })],
    ["expenseSplits", prisma.expenseSplit.count({ where: { userId: user.id } })],
    ["goals (created)", prisma.goal.count({ where: { createdById: user.id } })],
    ["goalAllocations", prisma.goalAllocation.count({ where: { OR: [{ userId: user.id }, { createdById: user.id }] } })],
    ["balances (debtor)", prisma.balance.count({ where: { debtorId: user.id } })],
    ["balances (creditor)", prisma.balance.count({ where: { creditorId: user.id } })],
    ["settlements", prisma.settlement.count({ where: { OR: [{ debtorId: user.id }, { creditorId: user.id }, { createdById: user.id }, { confirmedById: user.id }] } })],
    ["notifications", prisma.notification.count({ where: { userId: user.id } })],
    ["invitations (sent)", prisma.invitation.count({ where: { invitedById: user.id } })],
    ["joinRequests", prisma.joinRequest.count({ where: { OR: [{ userId: user.id }, { reviewedById: user.id }] } })],
    ["wallets", prisma.wallet.count({ where: { userId: user.id } })],
    ["walletTransactions", prisma.walletTransaction.count({ where: { initiatedById: user.id } })],
    ["approvalRequests", prisma.approvalRequest.count({ where: { requestedById: user.id } })],
    ["approvalDecisions", prisma.approvalRequestDecision.count({ where: { reviewerId: user.id } })],
    ["approvalDelegations", prisma.approvalDelegation.count({ where: { OR: [{ delegatorMemberId: user.id }, { delegateMemberId: user.id }] } })],
    ["receipts (issued to)", prisma.financialReceipt.count({ where: { issuedToUserId: user.id } })],
    ["receipts (issued by)", prisma.financialReceipt.count({ where: { issuedByUserId: user.id } })],
    ["projects (created)", prisma.project.count({ where: { createdById: user.id } })],
    ["projectExpenses", prisma.projectExpense.count({ where: { OR: [{ createdById: user.id }, { approvedById: user.id }, { paidById: user.id }] } })],
    ["projectContributions", prisma.projectContribution.count({ where: { OR: [{ userId: user.id }, { confirmedById: user.id }] } })],
    ["feedPosts", prisma.feedPost.count({ where: { authorId: user.id } })],
    ["feedComments", prisma.feedComment.count({ where: { userId: user.id } })],
    ["feedReactions", prisma.feedReaction.count({ where: { userId: user.id } })],
    ["circleEvents (created)", prisma.circleEvent.count({ where: { createdById: user.id } })],
    ["circleEventRSVPs", prisma.circleEventRSVP.count({ where: { userId: user.id } })],
    ["circlePolls (created)", prisma.circlePoll.count({ where: { createdById: user.id } })],
    ["circlePollVotes", prisma.circlePollVote.count({ where: { userId: user.id } })],
    ["supportTickets", prisma.supportTicket.count({ where: { userId: user.id } })],
    ["supportMessages", prisma.supportTicketMessage.count({ where: { senderId: user.id } })],
    ["auditLogs", prisma.auditLog.count({ where: { userId: user.id } })],
    ["subscription", prisma.userSubscription.count({ where: { userId: user.id } })],
    ["internalAdmin", prisma.internalAdmin.count({ where: { userId: user.id } })],
    ["sessions", prisma.session.count({ where: { userId: user.id } })],
    ["accounts", prisma.account.count({ where: { userId: user.id } })],
  ]

  let totalRecords = 0
  for (const [name, query] of countQueries) {
    try {
      const count = await query
      if (count > 0) {
        console.log(`  ${name}: ${count}`)
        totalRecords += count
      }
    } catch {
      console.log(`  ${name}: (error)`)
    }
  }

  console.log(`\n  Total: ${totalRecords} records to reset\n`)

  if (totalRecords === 0 && !deleteUser) {
    console.log("Nothing to reset -- user data is already clean.")
    return
  }

  if (dryRun) {
    console.log("Dry run complete. No changes made.")
    console.log("  To execute: npx tsx scripts/reset-user-data.ts --email " + email + " --execute")
    return
  }

  // Execute deletion
  console.log("Executing data reset...\n")

  let deleted = 0
  let skipped = 0
  let failed = 0

  async function del(label: string, fn: () => Promise<any>) {
    try {
      const result = await fn()
      const count = result?.count ?? 0
      if (count > 0) {
        console.log(`  ${label}: deleted ${count}`)
        deleted += count
      } else {
        skipped++
      }
    } catch (err: any) {
      if (err?.code === "P2021" || err?.code === "P2003") {
        skipped++
      } else {
        console.log(`  ${label}: FAILED -- ${err.message?.slice(0, 80)}`)
        failed++
      }
    }
  }

  const uid = user.id

  // Delete in dependency order
  await del("approvalDecisions", () => prisma.approvalRequestDecision.deleteMany({ where: { reviewerId: uid } }))
  await del("approvalRequestStageReviewers", () => prisma.approvalRequestStageReviewer.deleteMany({ where: { memberId: uid } }))
  await del("approvalRequestStages", () => prisma.approvalRequestStage.deleteMany({ where: { approvalRequest: { requestedById: uid } } }))
  await del("approvalRequests", () => prisma.approvalRequest.deleteMany({ where: { requestedById: uid } }))
  await del("approvalDelegations (delegator)", () => prisma.approvalDelegation.deleteMany({ where: { delegatorMemberId: uid } }))
  await del("approvalDelegations (delegate)", () => prisma.approvalDelegation.deleteMany({ where: { delegateMemberId: uid } }))
  await del("approvalWorkflowStageReviewers", () => prisma.approvalWorkflowStageReviewer.deleteMany({ where: { memberId: uid } }))
  await del("approvalWorkflows", () => prisma.approvalWorkflow.deleteMany({ where: { createdById: uid } }))

  await del("financialReceipts", () => prisma.financialReceipt.deleteMany({ where: { OR: [{ issuedToUserId: uid }, { issuedByUserId: uid }, { voidedByUserId: uid }] } }))
  await del("paymentTransactions", () => prisma.paymentTransaction.deleteMany({ where: { userId: uid } }))
  await del("transactions", () => prisma.transaction.deleteMany({ where: { initiatedById: uid } }))

  await del("walletApprovalRequests", () => prisma.walletApprovalRequest.deleteMany({ where: { requestedById: uid } }))
  await del("walletApprovals", () => prisma.walletApproval.deleteMany({ where: { approvedById: uid } }))
  await del("walletTransactions", () => prisma.walletTransaction.deleteMany({ where: { initiatedById: uid } }))
  await del("wallets", () => prisma.wallet.deleteMany({ where: { userId: uid } }))
  await del("payoutCycles", () => prisma.payoutCycle.deleteMany({ where: { recipientId: uid } }))

  await del("projectContributions", () => prisma.projectContribution.deleteMany({ where: { OR: [{ userId: uid }, { confirmedById: uid }] } }))
  await del("projectDistributionItems", () => prisma.projectDistributionItem.deleteMany({ where: { userId: uid } }))
  await del("projectDistributions", () => prisma.projectDistribution.deleteMany({ where: { OR: [{ createdById: uid }, { approvedById: uid }] } }))
  await del("projectRevenues", () => prisma.projectRevenue.deleteMany({ where: { createdById: uid } }))
  await del("projectAssets", () => prisma.projectAsset.deleteMany({ where: { createdById: uid } }))
  await del("projectExpenses", () => prisma.projectExpense.deleteMany({ where: { OR: [{ createdById: uid }, { approvedById: uid }, { paidById: uid }] } }))
  await del("projectFundingRounds", () => prisma.projectFundingRound.deleteMany({ where: { createdById: uid } }))
  await del("projects", () => prisma.project.deleteMany({ where: { createdById: uid } }))

  await del("feedReactions", () => prisma.feedReaction.deleteMany({ where: { userId: uid } }))
  await del("feedComments", () => prisma.feedComment.deleteMany({ where: { userId: uid } }))
  await del("feedPosts", () => prisma.feedPost.deleteMany({ where: { authorId: uid } }))

  await del("circlePollVotes", () => prisma.circlePollVote.deleteMany({ where: { userId: uid } }))
  await del("circleEventRSVPs", () => prisma.circleEventRSVP.deleteMany({ where: { userId: uid } }))
  await del("circleEvents", () => prisma.circleEvent.deleteMany({ where: { createdById: uid } }))
  await del("circlePolls", () => prisma.circlePoll.deleteMany({ where: { createdById: uid } }))

  await del("circleModerationReviews", () => prisma.circleModerationReview.deleteMany({ where: { reviewedById: uid } }))
  await del("abuseReports", () => prisma.abuseReport.deleteMany({ where: { OR: [{ reporterId: uid }, { reviewedById: uid }] } }))

  await del("supportTicketMessages", () => prisma.supportTicketMessage.deleteMany({ where: { senderId: uid } }))
  await del("supportTickets", () => prisma.supportTicket.deleteMany({ where: { userId: uid } }))

  await del("invitations", () => prisma.invitation.deleteMany({ where: { invitedById: uid } }))
  await del("joinRequests", () => prisma.joinRequest.deleteMany({ where: { OR: [{ userId: uid }, { reviewedById: uid }] } }))

  await del("goalAllocations", () => prisma.goalAllocation.deleteMany({ where: { OR: [{ userId: uid }, { createdById: uid }] } }))
  await del("goals", () => prisma.goal.deleteMany({ where: { createdById: uid } }))

  await del("expenseSplits", () => prisma.expenseSplit.deleteMany({ where: { userId: uid } }))
  await del("expenses", () => prisma.expense.deleteMany({ where: { OR: [{ paidById: uid }, { createdById: uid }] } }))
  await del("contributionPlans", () => prisma.contributionPlan.deleteMany({ where: { createdById: uid } }))
  await del("contributions", () => prisma.contribution.deleteMany({ where: { OR: [{ userId: uid }, { createdById: uid }] } }))

  await del("balances", () => prisma.balance.deleteMany({ where: { OR: [{ debtorId: uid }, { creditorId: uid }] } }))
  await del("settlements", () => prisma.settlement.deleteMany({ where: { OR: [{ debtorId: uid }, { creditorId: uid }, { createdById: uid }, { confirmedById: uid }] } }))

  await del("circleInviteEvents", () => prisma.circleInviteEvent.deleteMany({ where: { userId: uid } }))
  await del("circleWidgets", () => prisma.circleWidget.deleteMany({ where: { circle: { members: { some: { userId: uid } } } } }))

  // Handle circle ownership
  const ownedCircles = await prisma.circle.findMany({
    where: { createdById: uid },
    select: { id: true, name: true, _count: { select: { members: { where: { userId: { not: uid } } } } } },
  })

  for (const circle of ownedCircles) {
    if (circle._count.members > 0 && !deleteOwnedCircles) {
      console.log(`  Skipping circle "${circle.name}" -- has ${circle._count.members} other member(s)`)
      skipped++
      continue
    }
    try {
      await prisma.circleMember.deleteMany({ where: { circleId: circle.id } })
      await prisma.circle.delete({ where: { id: circle.id } })
      console.log(`  Circle "${circle.name}" deleted`)
      deleted++
    } catch (err: any) {
      console.log(`  Circle "${circle.name}": FAILED -- ${err.message?.slice(0, 80)}`)
      failed++
    }
  }

  // Remove remaining memberships
  await del("circleMembers", () => prisma.circleMember.deleteMany({ where: { userId: uid } }))

  await del("notifications", () => prisma.notification.deleteMany({ where: { userId: uid } }))
  await del("platformBroadcastRecipients", () => prisma.platformBroadcastRecipient.deleteMany({ where: { userId: uid } }))
  await del("platformBroadcasts", () => prisma.platformBroadcast.deleteMany({ where: { createdById: uid } }))
  await del("promoRedemptions", () => prisma.promoRedemption.deleteMany({ where: { userId: uid } }))
  await del("promoCodes", () => prisma.promoCode.deleteMany({ where: { createdById: uid } }))
  await del("bulkOperations", () => prisma.bulkOperation.deleteMany({ where: { adminId: uid } }))
  await del("ownerNotes", () => prisma.ownerNote.deleteMany({ where: { adminId: uid } }))

  await del("userLegalAcceptances", () => prisma.userLegalAcceptance.deleteMany({ where: { userId: uid } }))
  await del("mobileSessions", () => prisma.mobileSession.deleteMany({ where: { userId: uid } }))
  await del("mobilePushTokens", () => prisma.mobilePushToken.deleteMany({ where: { userId: uid } }))

  await del("auditLogs", () => prisma.auditLog.deleteMany({ where: { userId: uid } }))
  await del("sessions", () => prisma.session.deleteMany({ where: { userId: uid } }))
  await del("accounts", () => prisma.account.deleteMany({ where: { userId: uid } }))
  await del("userSubscription", () => prisma.userSubscription.deleteMany({ where: { userId: uid } }))
  await del("internalAdmin", () => prisma.internalAdmin.deleteMany({ where: { userId: uid } }))

  if (deleteUser) {
    await del("user (account)", () => prisma.user.delete({ where: { id: uid } }))
  }

  console.log(`\nSummary:`)
  console.log(`  Deleted: ${deleted} records`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed:  ${failed}`)

  if (deleteUser) {
    console.log(`\nUser account "${user.email}" has been permanently deleted.`)
  } else {
    console.log(`\nUser account "${user.email}" preserved. All application data has been reset.`)
    console.log(`  The user can log in and start fresh.`)
  }

  console.log("")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
