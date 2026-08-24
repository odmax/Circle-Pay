import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readRouteFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

describe("E2E Production Journey Audit Fixes", () => {
  describe("C1: Contribution approve action — atomic status transition", () => {
    const src = readRouteFile("src/app/api/circles/[circleId]/contributions/[contributionId]/route.ts")
    const service = readFile("src/lib/services/contribution.service.ts")

    it("route delegates to confirmContribution instead of setting CONFIRMED directly", () => {
      expect(src).toContain("await confirmContribution(circleId, contributionId, session.user.id)")
    })

    it("route does NOT set status: CONFIRMED before calling confirmContribution", () => {
      const approveSection = src.substring(src.indexOf("action === \"approve\""), src.indexOf("action === \"reject\""))
      expect(approveSection).not.toContain("status: \"CONFIRMED\"")
    })

    it("route does NOT have redundant audit log or notification for approve", () => {
      const approveSection = src.substring(src.indexOf("action === \"approve\""), src.indexOf("action === \"reject\""))
      expect(approveSection).not.toContain("CONTRIBUTION_APPROVED")
      expect(approveSection).not.toContain("createAuditLog")
      expect(approveSection).not.toContain("createNotification")
    })

    it("confirmContribution checks PENDING_REVIEW status atomically", () => {
      expect(service).toContain("if (contribution.status !== \"PENDING_REVIEW\")")
    })

    it("confirmContribution sets verifiedById and verifiedAt in same update", () => {
      const confirmFn = service.substring(service.indexOf("export async function confirmContribution"), service.indexOf("export async function rejectContribution"))
      expect(confirmFn).toContain("verifiedById: reviewerId")
      expect(confirmFn).toContain("verifiedAt: new Date()")
    })

    it("rejectContribution checks PENDING_REVIEW status atomically", () => {
      const rejectFn = service.substring(service.indexOf("export async function rejectContribution"), service.indexOf("async function replaceReceiptForContribution"))
      expect(rejectFn).toContain("if (contribution.status !== \"PENDING_REVIEW\")")
    })

    it("rejectContribution stores rejectedById, rejectedAt, rejectionReason", () => {
      const rejectFn = service.substring(service.indexOf("export async function rejectContribution"), service.indexOf("async function replaceReceiptForContribution"))
      expect(rejectFn).toContain("rejectedById: reviewerId")
      expect(rejectFn).toContain("rejectedAt: new Date()")
      expect(rejectFn).toContain("rejectionReason: reason")
    })

    it("reject route delegates to rejectContribution without duplicate logic", () => {
      const rejectSection = src.substring(src.indexOf("action === \"reject\""), src.indexOf("return NextResponse.json({ error: \"Unknown action\" }"))
      expect(rejectSection).toContain("await rejectContribution(circleId, contributionId, session.user.id, reason)")
      expect(rejectSection).not.toContain("status: \"REJECTED\"")
    })
  })

  describe("C2: Permission checks on upload-proof and verify", () => {
    const src = readRouteFile("src/app/api/circles/[circleId]/contributions/[contributionId]/route.ts")

    it("upload-proof checks ownership or CONTRIBUTION_REVIEW permission", () => {
      const uploadSection = src.substring(src.indexOf("action === \"upload-proof\""), src.indexOf("action === \"verify\""))
      expect(uploadSection).toContain("existing.userId === session.user.id")
      expect(uploadSection).toContain("CONTRIBUTION_REVIEW")
      expect(uploadSection).toContain("isOwner && !canReview")
    })

    it("verify action requires CONTRIBUTION_REVIEW permission", () => {
      const verifySection = src.substring(src.indexOf("action === \"verify\""), src.indexOf("action === \"approve\""))
      expect(verifySection).toContain("CONTRIBUTION_REVIEW")
    })
  })

  describe("C3: Settlement race condition — atomic status check", () => {
    const src = readFile("src/lib/services/balance.service.ts")

    it("confirmSettlement uses atomic status check in WHERE clause", () => {
      const confirmFn = src.substring(src.indexOf("export async function confirmSettlement"), src.indexOf("export async function rejectSettlement"))
      expect(confirmFn).toContain("where: { id: settlementId, status: \"PENDING\" }")
    })

    it("confirmSettlement handles concurrent confirmation gracefully", () => {
      const confirmFn = src.substring(src.indexOf("export async function confirmSettlement"), src.indexOf("export async function rejectSettlement"))
      expect(confirmFn).toContain("Settlement was already confirmed or rejected")
    })

    it("rejectSettlement uses atomic status check", () => {
      const rejectFn = src.substring(src.indexOf("export async function rejectSettlement"), src.length)
      expect(rejectFn).toContain("where: { id: settlementId, status: \"PENDING\" }")
    })

    it("settlement notification has .catch handler", () => {
      expect(src).toContain("notifyCircleMembers(circleId, userId, {\n    type: \"SETTLEMENT_CONFIRMED\"").valueOf() !== null
      const confirmFn = src.substring(src.indexOf("export async function confirmSettlement"), src.indexOf("export async function rejectSettlement"))
      expect(confirmFn).toContain(".catch(() => {})")
    })
  })

  describe("C4: Circle verification in poll/event services", () => {
    const poll = readFile("src/lib/services/poll.service.ts")
    const event = readFile("src/lib/services/event.service.ts")

    it("votePoll verifies poll belongs to circle", () => {
      const voteFn = poll.substring(poll.indexOf("export async function votePoll"), poll.indexOf("export async function closePoll"))
      expect(voteFn).toContain("poll.circleId !== circleId")
    })

    it("closePoll verifies poll belongs to circle", () => {
      const closeFn = poll.substring(poll.indexOf("export async function closePoll"), poll.length)
      expect(closeFn).toContain("poll.circleId !== circleId")
    })

    it("rsvpToEvent verifies event belongs to circle", () => {
      const rsvpFn = event.substring(event.indexOf("export async function rsvpToEvent"), event.indexOf("export async function cancelEvent"))
      expect(rsvpFn).toContain("event.circleId !== circleId")
    })

    it("cancelEvent verifies event belongs to circle", () => {
      const cancelFn = event.substring(event.indexOf("export async function cancelEvent"), event.indexOf("export async function getEventById"))
      expect(cancelFn).toContain("event.circleId !== circleId")
    })
  })

  describe("H1: Floating promises — all notifyCircleMembers have .catch", () => {
    const services = [
      "src/lib/services/contribution.service.ts",
      "src/lib/services/balance.service.ts",
      "src/lib/services/goal.service.ts",
      "src/lib/services/circle.service.ts",
      "src/lib/services/expense.service.ts",
    ]

    it.each(services)("all notifyCircleMembers in %s have error handling", (file) => {
      const src = readFile(file)
      const lines = src.split("\n")
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("notifyCircleMembers(")) {
          let found = false
          for (let j = i; j < Math.min(i + 15, lines.length); j++) {
            if (lines[j].includes(".catch(")) { found = true; break }
          }
          expect(found, `notifyCircleMembers at line ${i + 1} in ${file} has no .catch within 15 lines`).toBe(true)
        }
      }
    })

    it("notification.service.ts dynamic import has .catch", () => {
      const src = readFile("src/lib/services/notification.service.ts")
      expect(src).toContain("import(\"@/lib/services/push-notification.service\").then(")
      const pushLine = src.split("\n").find(l => l.includes("sendPushForNotification"))
      expect(pushLine).toContain(".catch(() => {})")
    })
  })

  describe("H2: Project endpoints — sub-routes exist", () => {
    const apiBase = "src/app/api/circles/[circleId]/projects/[projectId]"

    const expectedRoutes = [
      "funding-rounds/route.ts",
      "funding-rounds/[roundId]/open/route.ts",
      "funding-rounds/[roundId]/close/route.ts",
      "expenses/[expenseId]/submit/route.ts",
      "expenses/[expenseId]/approve/route.ts",
      "expenses/[expenseId]/reject/route.ts",
      "expenses/[expenseId]/paid/route.ts",
      "expenses/[expenseId]/void/route.ts",
      "expenses/[expenseId]/duplicate/route.ts",
      "distributions/route.ts",
      "distributions/[distributionId]/approve/route.ts",
      "distributions/[distributionId]/paid/route.ts",
      "distributions/[distributionId]/cancel/route.ts",
      "capital/[txId]/confirm/route.ts",
      "capital/[txId]/proof/route.ts",
      "shortfall/[shortfallId]/approve/route.ts",
    ]

    it.each(expectedRoutes)("route file exists: %s", (route) => {
      const fullPath = path.join(apiBase, route)
      expect(fs.existsSync(path.resolve(fullPath)), `Missing route: ${fullPath}`).toBe(true)
    })

    it("funding-rounds/route.ts has POST handler", () => {
      const src = readFile(`${apiBase}/funding-rounds/route.ts`)
      expect(src).toContain("export async function POST")
      expect(src).toContain("createFundingRound")
    })

    it("distributions/route.ts has POST handler", () => {
      const src = readFile(`${apiBase}/distributions/route.ts`)
      expect(src).toContain("export async function POST")
      expect(src).toContain("createProfitDistribution")
    })

    it("expense sub-routes have proper permission checks", () => {
      const approve = readFile(`${apiBase}/expenses/[expenseId]/approve/route.ts`)
      expect(approve).toContain("PROJECT_EXPENSE_APPROVE")
      const voidRoute = readFile(`${apiBase}/expenses/[expenseId]/void/route.ts`)
      expect(voidRoute).toContain("PROJECT_EXPENSE_VOID")
    })

    it("distribution sub-routes have PROJECT_APPROVE permission", () => {
      const approve = readFile(`${apiBase}/distributions/[distributionId]/approve/route.ts`)
      expect(approve).toContain("PROJECT_APPROVE")
    })

    it("capital confirm has FUNDING_RECORD permission", () => {
      const confirm = readFile(`${apiBase}/capital/[txId]/confirm/route.ts`)
      expect(confirm).toContain("FUNDING_RECORD")
    })

    it("shortfall approve has SHORTFALL_MANAGE permission", () => {
      const approve = readFile(`${apiBase}/shortfall/[shortfallId]/approve/route.ts`)
      expect(approve).toContain("SHORTFALL_MANAGE")
    })
  })

  describe("M1: Permission-denied errors return 403 not 500", () => {
    const src = readRouteFile("src/app/api/circles/[circleId]/contributions/[contributionId]/route.ts")

    it("POST catch block maps permission errors to 403", () => {
      const postCatch = src.substring(src.indexOf("} catch (error) {"), src.indexOf("export async function GET"))
      expect(postCatch).toContain("status: 403")
      expect(postCatch).toContain("Not a member")
      expect(postCatch).toContain("Insufficient permissions")
      expect(postCatch).toContain("Forbidden")
    })
  })

  describe("M3: Anonymous poll voter identity leak fixed", () => {
    const src = readFile("src/lib/services/poll.service.ts")

    it("getCirclePolls does NOT include individual votes with userId", () => {
      const getPollsFn = src.substring(src.indexOf("export async function getCirclePolls"), src.indexOf("export async function createPoll"))
      expect(getPollsFn).not.toContain("votes: { select: { userId:")
    })

    it("getCirclePolls still includes vote counts", () => {
      const getPollsFn = src.substring(src.indexOf("export async function getCirclePolls"), src.indexOf("export async function createPoll"))
      expect(getPollsFn).toContain("_count: { select: { votes: true } }")
    })
  })

  describe("M2: No duplicate notifications on approve/reject", () => {
    const src = readRouteFile("src/app/api/circles/[circleId]/contributions/[contributionId]/route.ts")

    it("approve action does not call createNotification or createAuditLog", () => {
      const approveSection = src.substring(src.indexOf("action === \"approve\""), src.indexOf("action === \"reject\""))
      expect(approveSection).not.toContain("createNotification(")
      expect(approveSection).not.toContain("createAuditLog(")
    })

    it("reject action does not call createNotification or createAuditLog", () => {
      const rejectSection = src.substring(src.indexOf("action === \"reject\""), src.indexOf("return NextResponse.json({ error: \"Unknown action\""))
      expect(rejectSection).not.toContain("createNotification(")
      expect(rejectSection).not.toContain("createAuditLog(")
    })
  })

  describe("Code quality: all sub-route files follow auth pattern", () => {
    const apiBase = "src/app/api/circles/[circleId]/projects/[projectId]"

    const subRoutes = [
      `${apiBase}/capital/[txId]/confirm/route.ts`,
      `${apiBase}/capital/[txId]/proof/route.ts`,
      `${apiBase}/funding-rounds/[roundId]/open/route.ts`,
      `${apiBase}/funding-rounds/[roundId]/close/route.ts`,
      `${apiBase}/expenses/[expenseId]/submit/route.ts`,
      `${apiBase}/expenses/[expenseId]/approve/route.ts`,
      `${apiBase}/expenses/[expenseId]/reject/route.ts`,
      `${apiBase}/expenses/[expenseId]/paid/route.ts`,
      `${apiBase}/expenses/[expenseId]/void/route.ts`,
      `${apiBase}/expenses/[expenseId]/duplicate/route.ts`,
      `${apiBase}/distributions/[distributionId]/approve/route.ts`,
      `${apiBase}/distributions/[distributionId]/paid/route.ts`,
      `${apiBase}/distributions/[distributionId]/cancel/route.ts`,
      `${apiBase}/shortfall/[shortfallId]/approve/route.ts`,
    ]

    it.each(subRoutes)("%s has auth, project check, and permission check", (route) => {
      const src = readFile(route)
      expect(src).toContain("await auth()")
      expect(src).toContain("requireProjectInCircle")
      expect(src).toContain("hasCirclePermission")
    })
  })
})
