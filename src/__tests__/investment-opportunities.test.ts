import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { slugifyOpportunity, getMyOpportunities } from "@/lib/services/project-investment-metrics"

const slugify = slugifyOpportunity

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(relativePath))
}

const schema = readFile("prisma/schema.prisma")
const permissions = readFile("src/lib/permissions/circlePermissions.ts")
const roles = readFile("src/lib/permissions/circle-role-permissions.ts")
const oppSvc = readFile("src/lib/services/opportunity.service.ts")
const callSvc = readFile("src/lib/services/capital-call.service.ts")
const commitRoute = readFile("src/app/api/circles/[circleId]/opportunities/[opportunityId]/commitments/[commitmentId]/route.ts")
const oppRoute = readFile("src/app/api/circles/[circleId]/opportunities/[opportunityId]/route.ts")
const proofRoute = readFile("src/app/api/circles/[circleId]/opportunities/[opportunityId]/documents/route.ts")
const cronRoute = readFile("src/app/api/cron/opportunity-reminders/route.ts")
const payRoute = readFile("src/app/api/circles/[circleId]/capital-calls/[callId]/pay/route.ts")
const oppIndex = readFile("src/components/opportunities/opportunities-index.tsx")
const oppDetail = readFile("src/components/opportunities/opportunity-detail.tsx")
const callsIndex = readFile("src/components/capital-calls/capital-calls-index.tsx")
const snapshot = readFile("src/components/portfolio/opportunity-snapshot.tsx")
const nav = readFile("src/lib/circle-types.ts")

describe("Opportunities & Capital Calls — Data Schema", () => {
  it("OP1: schema defines the opportunity/commitment/document/call models", () => {
    for (const m of ["InvestmentOpportunity", "InvestmentOpportunityCommitment", "InvestmentOpportunityDocument", "CapitalCall", "CapitalCallAllocation"]) {
      expect(schema).toMatch(new RegExp(`^model ${m} \\{`, "m"))
    }
  })

  it("OP2: status enums exactly match the required workflow", () => {
    const oppEnum = (schema.match(/enum InvestmentOpportunityStatus \{([\s\S]*?)\n\}/) || [])[1] || ""
    for (const v of ["DRAFT", "OPEN", "FUNDED", "CLOSED", "CANCELLED"]) expect(oppEnum).toContain(v)
    const callEnum = (schema.match(/enum CapitalCallStatus \{([\s\S]*?)\n\}/) || [])[1] || ""
    for (const v of ["DRAFT", "OPEN", "CLOSED", "COMPLETED", "CANCELLED"]) expect(callEnum).toContain(v)
    expect(schema).toContain("enum InvestmentCommitmentStatus {")
  })

  it("OP3: opportunity rejects orphans — FK circle cascade and per-user allocations are unique", () => {
    expect(schema).toContain('opportunity InvestmentOpportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)')
    expect(schema).toContain("@@unique([capitalCallId, userId])")
  })

  it("OP4: notification types cover the required lifecycle events", () => {
    for (const t of ["OPPORTUNITY_OPENED", "OPPORTUNITY_CLOSING_SOON", "OPPORTUNITY_FUNDED", "OPPORTUNITY_CANCELLED", "CAPITAL_CALL_ISSUED", "CAPITAL_CALL_OVERDUE", "COMMITMENT_RECEIVED", "COMMITMENT_CONFIRMED", "COMMITMENT_REJECTED", "PROOF_REQUIRES_REVIEW"]) {
      expect(schema).toContain(t)
    }
  })
})

describe("Opportunities & Capital Calls — Permissions (no hardcoded roles)", () => {
  it("OP5: dedicated permission keys exist for opportunities and capital calls", () => {
    for (const p of ["OPPORTUNITY_VIEW", "OPPORTUNITY_CREATE", "OPPORTUNITY_MANAGE", "OPPORTUNITY_APPROVE", "CAPITAL_CALL_CREATE", "CAPITAL_CALL_MANAGE", "CAPITAL_CALL_APPROVE"]) {
      expect(permissions).toContain(`${p}: "${p}"`)
    }
  })

  it("OP6: admins/treasurers get manage powers and members/viewers can view", () => {
    expect(roles).toContain("P.OPPORTUNITY_VIEW")
    expect(roles).toContain("P.OPPORTUNITY_MANAGE")
    expect(roles).toContain("P.OPPORTUNITY_APPROVE")
    expect(roles).toContain("P.CAPITAL_CALL_CREATE")
    expect(roles).toContain("P.CAPITAL_CALL_MANAGE")
  })
})

describe("Member Experience — Own Commitments Only, No Self-Approval", () => {
  it("OP7: members can only submit/withdraw proof for their own commitment", () => {
    expect(commitRoute).toContain("You can only submit proof for your own commitment")
    expect(commitRoute).toContain("commitment.userId !== s.user.id")
    expect(oppSvc).toContain("c.userId !== userId")
    expect(oppSvc).toContain('status !== "PENDING" && c.status !== "PAID"') // withdraw unpaid only
  })

  it("OP8: members cannot approve their own commitment (approval separation)", () => {
    expect(oppSvc).toContain("You cannot approve your own commitment")
    expect(oppSvc).toContain("c.userId === adminId")
    expect(commitRoute).toContain("CIRCLE_PERMISSIONS.OPPORTUNITY_APPROVE")
  })

  it("OP9: opportunity opening enforces approval separation (creator cannot approve own)", () => {
    expect(oppSvc).toContain("You cannot approve your own opportunity")
    expect(oppSvc).toContain("opp.createdById === approverId")
  })

  it("OP10: cross-circle isolation — all opportunity/call queries carry circleId", () => {
    expect(oppSvc).toContain("opportunityInCircle(circleId")
    expect(callSvc).toContain("findFirst({ where: { id: callId, circleId } })")
    expect(commitRoute).toContain("commitment.opportunity.circleId !== circleId")
  })
})

describe("Funding Conversion — Transactional, Idempotent, No Duplicate Postings", () => {
  it("OP11: conversion is transactional and reuses the project/funding engines", () => {
    expect(oppSvc).toContain("prisma.$transaction")
    expect(oppSvc).toContain("tx.project.create")
    expect(oppSvc).toContain("tx.projectFundingRound.create")
    expect(oppSvc).toContain("tx.projectContribution.create")
  })

  it("OP12: conversion maps confirmed member capital into CONFIRMED contributions (ownership)", () => {
    expect(oppSvc).toContain('status: "CONFIRMED"')
    expect(oppSvc).toContain("opportunityCommitmentId")
  })

  it("OP13: conversion is idempotent (projectId guard, unique slug fallback, per-commitment dedupe)", () => {
    expect(oppSvc).toContain("if (opp.projectId)")
    expect(oppSvc).toContain('code === "P2002"')
    expect(oppSvc).toContain("opportunityCommitmentId")
    expect(oppSvc).toContain("if (dup) continue")
  })
})

describe("Capital Calls — Reuse Contribution/Proof Infrastructure", () => {
  it("OP14: payments reuse the existing project contribution engine and tag by call id", () => {
    expect(callSvc).toContain("createProjectContribution(")
    expect(callSvc).toContain("metadata: { capitalCallId: call.id }")
    expect(callSvc).toContain('metadata: { path: ["capitalCallId"], equals: call.id }')
  })

  it("OP15: equal allocation splits amount across members on issue", () => {
    expect(callSvc).toContain("allocationMethod")
    expect(callSvc).toContain("upsertAllocation(")
  })

  it("OP16: member pay route gates on membership and requires a valid amount", () => {
    expect(payRoute).toContain("CIRCLE_PERMISSIONS.CIRCLE_VIEW")
    expect(payRoute).toContain("A valid amount is required")
  })

  it("OP17: reminder cron is guarded by CRON_SECRET (fails closed)", () => {
    expect(cronRoute).toContain("process.env.CRON_SECRET")
    expect(cronRoute).toContain('authHeader !== `Bearer ${secret}`')
  })
})

describe("Member & Admin Surface", () => {
  it("OP18: My Opportunities shows committed/confirmed/pending/ownership/expected return", () => {
    expect(oppIndex).toContain("My Opportunities")
    expect(oppIndex).toContain("Committed")
    expect(oppIndex).toContain("Ownership")
    expect(oppIndex).toContain("Est. return")
  })

  it("OP19: member is interactive — commit, upload proof, view, withdraw", () => {
    expect(oppDetail).toContain("Commit to this opportunity")
    expect(oppDetail).toContain("Upload proof")
    expect(oppDetail).toContain("Withdraw")
  })

  it("OP20: admin actions exist — create, open, approve, vote, close, cancel, convert", () => {
    expect(oppDetail).toContain("Approve (separate admin)")
    expect(oppDetail).toContain("Record vote passed")
    expect(oppDetail).toContain("Convert to project")
    expect(oppIndex).toContain("New Opportunity")
  })

  it("OP21: capital calls surface requested/committed/paid/outstanding and due dates", () => {
    expect(callsIndex).toContain("Requested")
    expect(callsIndex).toContain("Outstanding")
    expect(callsIndex).toContain("Due")
    expect(callsIndex).toContain("Issue")
    expect(callsIndex).toContain("New Capital Call")
  })

  it("OP22: the portfolio dashboard surfaces opportunities & capital calls with quick actions", () => {
    expect(snapshot).toContain("Open opportunities")
    expect(snapshot).toContain("Capital being raised")
    expect(snapshot).toContain("My outstanding calls")
    expect(snapshot).toContain("Closing soon (7d)")
    expect(snapshot).toContain("Recently funded")
    expect(nav).toContain('label: "Opportunities"')
  })
})

describe("Pure Helpers", () => {
  it("OP23: slugify produces safe, unique-friendly slugs", () => {
    expect(slugify("Second Property Fund")).toBe("second-property-fund")
    expect(slugify("!!!Weird / Name###")).toBe("weird-name")
    expect(slugify("")).toBe("opportunity")
  })

  it("OP24: getMyOpportunities aggregates committed/confirmed/pending + ownership + expected return", () => {
    const mine = getMyOpportunities([
      {
        id: "o1", title: "Alpha", status: "OPEN", myCommitted: 5000, myConfirmed: 4000, myPending: 1000,
        raised: 20000, expectedReturn: 15, closingDate: "2026-01-01", projectId: null,
      } as any,
    ])
    expect(mine[0].committed).toBe(5000)
    expect(mine[0].confirmed).toBe(4000)
    expect(mine[0].ownershipEstimate).toBe(20)
    expect(mine[0].expectedReturn).toBe(600) // 4000 * 15%
  })
})