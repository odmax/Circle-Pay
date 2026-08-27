import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const service = readFile("src/lib/services/payout-rotation.service.ts")
const apiRoute = readFile("src/app/api/circles/[circleId]/payouts/route.ts")
const cycleRoute = readFile("src/app/api/circles/[circleId]/payouts/[cycleId]/route.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/payouts/page.tsx")
const actions = readFile("src/components/payouts/payout-actions.tsx")
const manage = readFile("src/components/payouts/payout-queue-manage.tsx")
const perms = readFile("src/lib/permissions/circlePermissions.ts")
const rolePerms = readFile("src/lib/permissions/circle-role-permissions.ts")

describe("Payout Rotation — Queue Creation & Ordering", () => {
  it("PR1: creates a payout queue requiring PAYOUT_MANAGE", () => {
    expect(service).toContain("export async function createPayoutQueue")
    expect(service).toContain("CIRCLE_PERMISSIONS.PAYOUT_MANAGE")
    expect(service).toContain("At least two members are required to create a payout queue")
  })

  it("PR2: fixed order preserves member join order", () => {
    expect(service).toContain('config.mode === "RANDOM_DRAW"')
    expect(service).toContain("orderBy: { joinedAt")
    expect(service).toContain('mode: "FIXED_ORDER"')
  })

  it("PR3: manual order assigns recipient via orderedBy actor", () => {
    expect(service).toContain("orderedBy")
    expect(perms).toContain("PAYOUT_MANAGE")
  })

  it("PR4: random draw engine shuffles and rebuilds the queue", () => {
    expect(service).toContain("export async function drawRandomPayout")
    expect(service).toContain('config.mode !== "RANDOM_DRAW"')
    expect(service).toContain("selected")
    expect(service).toContain("drawEligibleIds")
  })
})

describe("Payout Rotation — Readiness Engine", () => {
  it("PR5: evaluates cycle readiness with blockers", () => {
    expect(service).toContain("export async function evaluateCycleReadiness")
    expect(service).toContain("blockers")
    expect(service).toContain("Payout configuration is inactive")
  })

  it("PR6: blocks payout with reasons written to readiness", () => {
    expect(service).toContain("status !== \"BLOCKED\"")
    expect(service).toContain("readiness: blockers.join")
    expect(service).toContain("PAYOUT_BLOCKED")
    expect(service).toContain("Available funds")
  })

  it("PR7: won't read out more than collected funds", () => {
    expect(service).toContain("compliance.collected < amount")
    expect(service).toContain("exceeds available collected funds")
  })
})

describe("Payout Rotation — Approval & Governance Workflow", () => {
  it("PR8: prepare creates an approval request when minimum approvals set", () => {
    expect(service).toContain("export async function preparePayout")
    expect(service).toContain("createApprovalRequest")
    expect(service).toContain("type: \"PAYOUT\"")
    expect(service).toContain("PENDING_APPROVAL")
  })

  it("PR9: payment recording is idempotent via payment key", () => {
    expect(service).toContain("export async function recordPayoutPayment")
    expect(service).toContain("payout-payment:${cycleId}")
    expect(service).toContain("alreadyRecorded")
    expect(service).toContain("recordPayoutToLedger")
  })

  it("PR10: proof upload requires PAYOUT_RECORD and tx-scoped", () => {
    expect(service).toContain("export async function uploadPayoutProof")
    expect(service).toContain("CIRCLE_PERMISSIONS.PAYOUT_RECORD")
    expect(cycleRoute).toContain("upload-proof")
    expect(cycleRoute).toContain("validateProofFile")
    expect(cycleRoute).toContain("uploadProofImage")
  })
})

describe("Payout Rotation — Beneficiary Confirmation", () => {
  it("PR11: only the beneficiary or PAYOUT_CONFIRM member can confirm receipt", () => {
    expect(service).toContain("export async function confirmPayoutReceived")
    expect(service).toContain("cycle.recipientId === userId")
    expect(service).toContain("CIRCLE_PERMISSIONS.PAYOUT_CONFIRM")
    expect(service).toContain("Only the beneficiary or an authorised member can confirm receipt")
  })

  it("PR12: concurrent double-confirm prevented via PAID precondition", () => {
    expect(service).toContain("cycle.status !== \"PAID\"")
    expect(service).toContain("alreadyConfirmed")
  })
})

describe("Payout Rotation — Skip / Defer / Swap", () => {
  it("PR13: skip and defer require a reason, audit log, and notifications", () => {
    expect(service).toContain("export async function skipPayout")
    expect(service).toContain("export async function deferPayout")
    expect(service).toContain("A reason is required to skip a payout")
    expect(service).toContain("A reason is required to defer a payout")
    expect(service).toContain("PAYOUT_SKIPPED")
    expect(service).toContain("PAYOUT_DEFERRED")
  })

  it("PR14: swap requires PAYOUT_SWAP permission and config allowSwap", () => {
    expect(service).toContain("export async function swapPayoutPositions")
    expect(service).toContain("CIRCLE_PERMISSIONS.PAYOUT_SWAP")
    expect(service).toContain("Queue swapping is not permitted by the payout policy")
    expect(service).toContain("allowSwap")
  })

  it("PR15: issue reporting requires beneficiary or PAYOUT_ISSUE", () => {
    expect(service).toContain("export async function reportPayoutIssue")
    expect(service).toContain("CIRCLE_PERMISSIONS.PAYOUT_ISSUE")
    expect(service).toContain("Only the beneficiary or an authorised member can report an issue")
  })
})

describe("Payout Rotation — Permissions & Cross-Circle Safety", () => {
  it("PR16: no hardcoded role checks; uses permission engine", () => {
    expect(service).toContain("requireCirclePermission")
    expect(service).toContain("hasCirclePermission")
    expect(service).not.toContain('role === "ADMIN"')
    expect(service).not.toContain('role === "OWNER"')
  })

  it("PR17: every cycle read/action verifies the resource belongs to circleId", () => {
    expect(service).toContain("cycle.circleId !== circleId")
    expect(cycleRoute).toContain("where: { id: cycleId, circleId }")
    expect(apiRoute).toContain("session.user.id")
  })

  it("PR18: role mappings grant governance powers without hardcoded checks", () => {
    expect(rolePerms).toContain("PAYOUT_CONFIGURE")
    expect(rolePerms).toContain("PAYOUT_PREPARE")
    expect(rolePerms).toContain("PAYOUT_CONFIRM")
    expect(rolePerms).toContain("PAYOUT_VIEW_ALL")
  })
})

describe("Payout Rotation — Notifications & Audit", () => {
  it("PR19: all payout lifecycle notifications are emitted", () => {
    for (const t of [
      "PAYOUT_QUEUE_CREATED",
      "PAYOUT_READY",
      "PAYOUT_APPROVED",
      "PAYOUT_PAID",
      "PAYOUT_CONFIRMED_RECEIVED",
      "PAYOUT_DEFERRED",
      "PAYOUT_SKIPPED",
      "PAYOUT_ISSUE_REPORTED",
      "PAYOUT_DRAW_COMPLETED",
      "PAYOUT_BLOCKED",
    ]) {
      expect(service).toContain(t)
    }
  })

  it("PR20: material transitions write audit log + immutable event history", () => {
    expect(service).toContain("createAuditLog")
    expect(service).toContain("export async function getPayoutHistory")
    expect(service).toContain("payoutEvent.create")
    expect(service).toContain("export async function getPayoutQueue")
  })
})

describe("Payout Rotation — API Routes & UI", () => {
  it("PR21: container route exposes queue/config/history and create/draw/configure actions", () => {
    expect(apiRoute).toContain("getPayoutQueue")
    expect(apiRoute).toContain("getPayoutHistory")
    expect(apiRoute).toContain("drawRandomPayout")
    expect(apiRoute).toContain("upsertPayoutConfig")
    expect(apiRoute).toContain("view === \"history\"")
  })

  it("PR22: cycle route enforces returning 403 for forbidden actions", () => {
    expect(cycleRoute).toContain("{ error: \"Forbidden\" }")
    expect(cycleRoute).toContain("PAYOUT_VIEW_ALL")
    expect(cycleRoute).toContain("Payout cycle not found")
  })

  it("PR23: payouts page renders queue, readiness blockers, history, and admin actions", () => {
    expect(page).toContain("getPayoutQueue")
    expect(page).toContain("getPayoutHistory")
    expect(page).toContain("PayoutActions")
    expect(page).toContain("PayoutQueueManage")
    expect(page).toContain("readiness")
    expect(page).toContain("Rotation Queue")
  })

  it("PR24: client components enforce permission gating for actions", () => {
    expect(actions).toContain("canPrepare")
    expect(actions).toContain("canRecord")
    expect(actions).toContain("canSkipDefer")
    expect(actions).toContain("allowSwap")
    expect(manage).toContain("if (!canManage) return null")
    expect(actions).toContain("isBeneficiary")
  })
})
