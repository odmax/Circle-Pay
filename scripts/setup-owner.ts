/**
 * Database cleanup and setup script for Ademoyemo@gmail.com
 *
 * Usage: npx tsx scripts/setup-owner.ts
 *
 * This script:
 * 1. Finds the user with email Ademoyemo@gmail.com
 * 2. Deletes ALL their data in dependency order
 * 3. Recreates them as a fresh user
 * 4. Assigns the Premium plan (circleLimit: 999 = unlimited)
 * 5. Creates InternalAdmin with SUPER_ADMIN role
 * 6. Seeds default plans if missing
 */

import { prisma } from "../src/lib/prisma"
import bcrypt from "bcryptjs"

const OWNER_EMAIL = "Ademoyemo@gmail.com"

async function main() {
  console.log(`\n🔧 Setup owner account: ${OWNER_EMAIL}\n`)

  // ─── 1. Find existing user ──────────────────────────────
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: OWNER_EMAIL, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  })

  if (existingUser) {
    console.log(` Found user: ${existingUser.email} (id: ${existingUser.id})`)
    console.log(` Deleting all data for this user...\n`)

    const userId = existingUser.id

    // ─── 2. Delete data in dependency order ─────────────────
    // Some relations have cascade, some don't. We delete explicitly
    // in reverse dependency order to be safe.

    const deletions = [
      // Approval workflow data (top-level references to userId)
      { name: "ApprovalRequestDecision", fn: () => prisma.approvalRequestDecision.deleteMany({ where: { reviewerId: userId } }) },
      { name: "ApprovalRequestStageReviewer", fn: () => prisma.approvalRequestStageReviewer.deleteMany({ where: { memberId: userId } }) },
      { name: "ApprovalRequestStage", fn: () => prisma.approvalRequestStage.deleteMany({ where: { approvalRequest: { requestedById: userId } } }) },
      { name: "ApprovalRequest", fn: () => prisma.approvalRequest.deleteMany({ where: { requestedById: userId } }) },
      { name: "ApprovalDelegation (delegator)", fn: () => prisma.approvalDelegation.deleteMany({ where: { delegatorMemberId: userId } }) },
      { name: "ApprovalDelegation (delegate)", fn: () => prisma.approvalDelegation.deleteMany({ where: { delegateMemberId: userId } }) },
      { name: "ApprovalWorkflowStageReviewer", fn: () => prisma.approvalWorkflowStageReviewer.deleteMany({ where: { memberId: userId } }) },
      { name: "ApprovalWorkflow", fn: () => prisma.approvalWorkflow.deleteMany({ where: { createdById: userId } }) },

      // Financial
      { name: "FinancialReceipt (issuedTo)", fn: () => prisma.financialReceipt.deleteMany({ where: { issuedToUserId: userId } }) },
      { name: "FinancialReceipt (issuedBy)", fn: () => prisma.financialReceipt.deleteMany({ where: { issuedByUserId: userId } }) },
      { name: "FinancialReceipt (voidedBy)", fn: () => prisma.financialReceipt.deleteMany({ where: { voidedByUserId: userId } }) },
      { name: "PaymentTransaction", fn: () => prisma.paymentTransaction.deleteMany({ where: { userId } }) },
      { name: "Transaction", fn: () => prisma.transaction.deleteMany({ where: { initiatedById: userId } }) },

      // Wallet
      { name: "WalletApprovalRequest", fn: () => prisma.walletApprovalRequest.deleteMany({ where: { requestedById: userId } }) },
      { name: "WalletApproval", fn: () => prisma.walletApproval.deleteMany({ where: { approvedById: userId } }) },
      { name: "WalletTransaction", fn: () => prisma.walletTransaction.deleteMany({ where: { initiatedById: userId } }) },
      { name: "Wallet", fn: () => prisma.wallet.deleteMany({ where: { userId } }) },
      { name: "PayoutCycle", fn: () => prisma.payoutCycle.deleteMany({ where: { recipientId: userId } }) },

      // Projects
      { name: "ProjectDistributionItem", fn: () => prisma.projectDistributionItem.deleteMany({ where: { userId } }) },
      { name: "ProjectDistribution (createdBy)", fn: () => prisma.projectDistribution.deleteMany({ where: { createdById: userId } }) },
      { name: "ProjectDistribution (approvedBy)", fn: () => prisma.projectDistribution.deleteMany({ where: { approvedById: userId } }) },
      { name: "ProjectRevenue", fn: () => prisma.projectRevenue.deleteMany({ where: { createdById: userId } }) },
      { name: "ProjectAsset", fn: () => prisma.projectAsset.deleteMany({ where: { createdById: userId } }) },
      { name: "ProjectExpense (createdBy)", fn: () => prisma.projectExpense.deleteMany({ where: { createdById: userId } }) },
      { name: "ProjectExpense (approvedBy)", fn: () => prisma.projectExpense.deleteMany({ where: { approvedById: userId } }) },
      { name: "ProjectExpense (paidBy)", fn: () => prisma.projectExpense.deleteMany({ where: { paidById: userId } }) },
      { name: "ProjectContribution (userId)", fn: () => prisma.projectContribution.deleteMany({ where: { userId } }) },
      { name: "ProjectContribution (confirmedBy)", fn: () => prisma.projectContribution.deleteMany({ where: { confirmedById: userId } }) },
      { name: "ProjectFundingRound", fn: () => prisma.projectFundingRound.deleteMany({ where: { createdById: userId } }) },
      { name: "Project", fn: () => prisma.project.deleteMany({ where: { createdById: userId } }) },

      // Feed
      { name: "FeedReaction", fn: () => prisma.feedReaction.deleteMany({ where: { userId } }) },
      { name: "FeedComment", fn: () => prisma.feedComment.deleteMany({ where: { userId } }) },
      { name: "FeedPost", fn: () => prisma.feedPost.deleteMany({ where: { authorId: userId } }) },

      // Events & Polls
      { name: "CirclePollVote", fn: () => prisma.circlePollVote.deleteMany({ where: { userId } }) },
      { name: "CircleEventRSVP", fn: () => prisma.circleEventRSVP.deleteMany({ where: { userId } }) },
      { name: "CircleEvent", fn: () => prisma.circleEvent.deleteMany({ where: { createdById: userId } }) },
      { name: "CirclePoll", fn: () => prisma.circlePoll.deleteMany({ where: { createdById: userId } }) },

      // Verification & Workflow
      { name: "CircleVerification", fn: () => prisma.circleVerification.deleteMany({ where: { reviewedById: userId } }) },
      { name: "CircleWorkflowStep", fn: () => prisma.circleWorkflowStep.deleteMany({ where: { completedById: userId } }) },
      { name: "CirclePaymentIntent (userId)", fn: () => prisma.circlePaymentIntent.deleteMany({ where: { userId } }) },
      { name: "CirclePaymentIntent (confirmedBy)", fn: () => prisma.circlePaymentIntent.deleteMany({ where: { confirmedById: userId } }) },

      // Moderation & Abuse
      { name: "CircleModerationReview", fn: () => prisma.circleModerationReview.deleteMany({ where: { reviewedById: userId } }) },
      { name: "AbuseReport (reporter)", fn: () => prisma.abuseReport.deleteMany({ where: { reporterId: userId } }) },
      { name: "AbuseReport (reviewer)", fn: () => prisma.abuseReport.deleteMany({ where: { reviewedById: userId } }) },

      // Support
      { name: "SupportTicketMessage", fn: () => prisma.supportTicketMessage.deleteMany({ where: { senderId: userId } }) },
      { name: "SupportTicket", fn: () => prisma.supportTicket.deleteMany({ where: { userId } }) },

      // Invitations & Join Requests
      { name: "Invitation", fn: () => prisma.invitation.deleteMany({ where: { invitedById: userId } }) },
      { name: "JoinRequest (user)", fn: () => prisma.joinRequest.deleteMany({ where: { userId } }) },
      { name: "JoinRequest (reviewer)", fn: () => prisma.joinRequest.deleteMany({ where: { reviewedById: userId } }) },

      // Goals
      { name: "GoalAllocation (receiver)", fn: () => prisma.goalAllocation.deleteMany({ where: { userId } }) },
      { name: "GoalAllocation (creator)", fn: () => prisma.goalAllocation.deleteMany({ where: { createdById: userId } }) },
      { name: "Goal", fn: () => prisma.goal.deleteMany({ where: { createdById: userId } }) },

      // Expenses & Contributions
      { name: "ExpenseSplit", fn: () => prisma.expenseSplit.deleteMany({ where: { userId } }) },
      { name: "Expense (payer)", fn: () => prisma.expense.deleteMany({ where: { paidById: userId } }) },
      { name: "Expense (creator)", fn: () => prisma.expense.deleteMany({ where: { createdById: userId } }) },
      { name: "ContributionPlan", fn: () => prisma.contributionPlan.deleteMany({ where: { createdById: userId } }) },
      { name: "Contribution", fn: () => prisma.contribution.deleteMany({ where: { userId } }) },

      // Balances & Settlements
      { name: "Balance (debtor)", fn: () => prisma.balance.deleteMany({ where: { debtorId: userId } }) },
      { name: "Balance (creditor)", fn: () => prisma.balance.deleteMany({ where: { creditorId: userId } }) },
      { name: "Settlement (debtor)", fn: () => prisma.settlement.deleteMany({ where: { debtorId: userId } }) },
      { name: "Settlement (creditor)", fn: () => prisma.settlement.deleteMany({ where: { creditorId: userId } }) },
      { name: "Settlement (creator)", fn: () => prisma.settlement.deleteMany({ where: { createdById: userId } }) },
      { name: "Settlement (confirmer)", fn: () => prisma.settlement.deleteMany({ where: { confirmedById: userId } }) },

      // Circle-level
      { name: "CircleInviteEvent", fn: () => prisma.circleInviteEvent.deleteMany({ where: { userId } }) },
      { name: "CircleWidget", fn: () => prisma.circleWidget.deleteMany({ where: { circle: { members: { some: { userId } } } } }) },
      { name: "CircleMember", fn: () => prisma.circleMember.deleteMany({ where: { userId } }) },
      { name: "Circle (createdBy)", fn: () => prisma.circle.deleteMany({ where: { createdById: userId } }) },

      // Notifications & Platform
      { name: "Notification", fn: () => prisma.notification.deleteMany({ where: { userId } }) },
      { name: "PlatformBroadcastRecipient", fn: () => prisma.platformBroadcastRecipient.deleteMany({ where: { userId } }) },
      { name: "PlatformBroadcast", fn: () => prisma.platformBroadcast.deleteMany({ where: { createdById: userId } }) },
      { name: "PromoRedemption", fn: () => prisma.promoRedemption.deleteMany({ where: { userId } }) },
      { name: "PromoCode", fn: () => prisma.promoCode.deleteMany({ where: { createdById: userId } }) },
      { name: "BulkOperation", fn: () => prisma.bulkOperation.deleteMany({ where: { adminId: userId } }) },
      { name: "OwnerNote", fn: () => prisma.ownerNote.deleteMany({ where: { adminId: userId } }) },

      // Legal & Mobile
      { name: "UserLegalAcceptance", fn: () => prisma.userLegalAcceptance.deleteMany({ where: { userId } }) },
      { name: "MobileSession", fn: () => prisma.mobileSession.deleteMany({ where: { userId } }) },
      { name: "MobilePushToken", fn: () => prisma.mobilePushToken.deleteMany({ where: { userId } }) },

      // Auth & Session
      { name: "Account", fn: () => prisma.account.deleteMany({ where: { userId } }) },
      { name: "Session", fn: () => prisma.session.deleteMany({ where: { userId } }) },
      { name: "AuditLog", fn: () => prisma.auditLog.deleteMany({ where: { userId } }) },

      // Subscription
      { name: "UserSubscription", fn: () => prisma.userSubscription.deleteMany({ where: { userId } }) },

      // Admin
      { name: "InternalAdmin", fn: () => prisma.internalAdmin.deleteMany({ where: { userId } }) },
    ]

    for (const d of deletions) {
      try {
        const result = await d.fn()
        if (result.count > 0) {
          console.log(`  ✓ ${d.name}: deleted ${result.count} record(s)`)
        }
      } catch (err: any) {
        // Some models may not exist yet — skip silently
        if (err?.code === "P2021" || err?.code === "P2003") {
          // Table doesn't exist or FK constraint — skip
        } else {
          console.log(`  ⚠ ${d.name}: ${err.message?.slice(0, 80)}`)
        }
      }
    }

    // Finally delete the user
    await prisma.user.delete({ where: { id: userId } })
    console.log(`  ✓ User deleted: ${existingUser.email}\n`)
  } else {
    console.log(` No existing user found with email ${OWNER_EMAIL}\n`)
  }

  // ─── 3. Ensure plans exist ─────────────────────────────
  console.log(" Ensuring plans exist...")
  const plans = [
    {
      name: "Free",
      slug: "free",
      description: "For individuals getting started",
      price: 0,
      currency: "ZAR",
      interval: "MONTHLY" as const,
      circleLimit: 3,
      sortOrder: 0,
      features: ["Up to 3 circles", "Basic expense tracking", "Basic contributions"],
    },
    {
      name: "Premium",
      slug: "premium",
      description: "Unlimited access for power users",
      price: 49,
      currency: "ZAR",
      interval: "MONTHLY" as const,
      circleLimit: 999,
      sortOrder: 1,
      features: ["Unlimited circles", "Advanced tracking", "Reports", "Priority support"],
    },
    {
      name: "Community",
      slug: "community",
      description: "For stokvels and community organizations",
      price: 99,
      currency: "ZAR",
      interval: "MONTHLY" as const,
      circleLimit: 999,
      sortOrder: 2,
      features: ["Unlimited circles", "Stokvel tools", "Community finance", "Priority support"],
    },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: { circleLimit: plan.circleLimit, features: plan.features },
    })
  }
  console.log("  ✓ Plans seeded\n")

  // ─── 4. Create fresh owner user ─────────────────────────
  console.log(" Creating fresh owner user...")
  const passwordHash = await bcrypt.hash("Owner@2024!", 12)

  const user = await prisma.user.create({
    data: {
      email: OWNER_EMAIL,
      name: "Ademoye Mo",
      passwordHash,
      currency: "NGN",
      emailVerified: new Date(),
    },
  })
  console.log(`  ✓ User created: ${user.email} (id: ${user.id})`)

  // ─── 5. Assign Premium plan (unlimited) ─────────────────
  const premiumPlan = await prisma.plan.findUnique({ where: { slug: "premium" } })
  if (premiumPlan) {
    const now = new Date()
    const farFuture = new Date(now.getFullYear() + 100, 0, 1)
    await prisma.userSubscription.create({
      data: {
        userId: user.id,
        planId: premiumPlan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: farFuture,
      },
    })
    console.log(`  ✓ Premium plan assigned (circleLimit: ${premiumPlan.circleLimit})`)
  }

  // ─── 6. Create InternalAdmin ────────────────────────────
  await prisma.internalAdmin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: "SUPER_ADMIN", isActive: true },
    update: { role: "SUPER_ADMIN", isActive: true },
  })
  console.log("  ✓ InternalAdmin created (SUPER_ADMIN)")

  console.log(`\n✅ Owner account ready!`)
  console.log(`   Email: ${OWNER_EMAIL}`)
  console.log(`   Password: Owner@2024!`)
  console.log(`   Plan: Premium (unlimited circles)`)
  console.log(`   Role: SUPER_ADMIN`)
  console.log(`\n   Make sure OWNER_EMAIL=${OWNER_EMAIL} is set in your .env\n`)
}

main()
  .catch((err) => {
    console.error("❌ Error:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
