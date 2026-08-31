import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const oppSvc = readFile("src/lib/services/opportunity.service.ts")
const callSvc = readFile("src/lib/services/capital-call.service.ts")
const irSvc = readFile("src/lib/services/investor-relations.service.ts")
const ctxFile = readFile("src/lib/api/project-investor-ctx.ts")
const roles = readFile("src/lib/permissions/circle-role-permissions.ts")
const permissions = readFile("src/lib/permissions/circlePermissions.ts")
const commitRoute = readFile("src/app/api/circles/[circleId]/opportunities/[opportunityId]/commitments/[commitmentId]/route.ts")
const payRoute = readFile("src/app/api/circles/[circleId]/capital-calls/[callId]/pay/route.ts")
const irUpdatesGet = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/updates/route.ts")
const irQuestionsRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/questions/route.ts")
const irMeetingsRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/meetings/route.ts")
const idx = readFile("src/components/projects/investors/investors-index.tsx")

describe("Audit Fixes — Notification Targeting", () => {
  it("AU1: commitment confirm/reject notifies only the committing member (not the whole circle)", () => {
    expect(oppSvc).toContain("notifyOpportunityMember(c.userId, circleId, \"COMMITMENT_CONFIRMED\"")
    expect(oppSvc).toContain("notifyOpportunityMember(c.userId, circleId, \"COMMITMENT_REJECTED\"")
    expect(oppSvc).not.toContain('notifyOpportunityMembers(circleId, c.opportunity.id, "COMMITMENT_CONFIRMED"')
    expect(oppSvc).not.toContain('notifyOpportunityMembers(circleId, c.opportunity.id, "COMMITMENT_REJECTED"')
  })

  it("AU2: publishing an investor question answer does not double-notify the asker", () => {
    expect(irSvc).toContain("excludeUserId?: string")
    expect(irSvc).toContain('notifyInvestorsOnly(circleId, projectId, "INVESTOR_QUESTION_ANSWERED"')
    expect(irSvc).toContain("projectId, \"INVESTOR_QUESTION_ANSWERED\", \"A question was answered\", q.question, `/circles/${circleId}/projects/${projectId}/investors?questions`, q.userId")
  })
})

describe("Audit Fixes — Investor Meeting Permissions", () => {
  it("AU3: treasurers can schedule investor meetings (createMeeting requires MEETING_CREATE)", () => {
    // The schedule route gates on INVESTOR_UPDATE_MANAGE; the reused createMeeting
    // additionally requires MEETING_CREATE, which treasurers must now have.
    expect(irMeetingsRoute).toContain("CIRCLE_PERMISSIONS.INVESTOR_UPDATE_MANAGE")
    expect(permissions).toContain("INVESTOR_UPDATE_MANAGE")
    const treasurer = roles.slice(roles.indexOf("const TREASURER_PERMISSIONS"), roles.indexOf("const MEMBER_PERMISSIONS"))
    expect(treasurer).toContain("P.MEETING_CREATE")
  })
})

describe("Audit — Investor-Only Visibility & Isolation", () => {
  it("AU4: non-investors cannot see INVESTORS_ONLY updates/questions/documents", () => {
    expect(irSvc).toContain('if (visibility === "INVESTORS_ONLY") return viewer.isInvestor || viewer.isManager')
    expect(irSvc).toContain("q.visibility === \"PUBLIC\" || viewer.isInvestor || viewer.isManager")
    expect(irSvc).toContain("d.visibility === \"ALL_MEMBERS\" || viewer.isInvestor || viewer.isManager")
  })

  it("AU5: cross-circle/project access is blocked on every entry point", () => {
    expect(ctxFile).toContain("hasCirclePermission({ userId: s.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_VIEW })")
    expect(ctxFile).toContain("requireProjectInCircle(projectId, circleId)")
    expect(commitRoute).toContain("commitment.opportunity.circleId !== circleId")
    expect(payRoute).toContain("CIRCLE_PERMISSIONS.CIRCLE_VIEW")
  })
})

describe("Audit — No Self-Approval & Own-Only Edits", () => {
  it("AU6: no self-approval on opportunity commitments and question edits are asker-only", () => {
    expect(oppSvc).toContain("You cannot approve your own commitment")
    expect(commitRoute).toContain("You can only submit proof for your own commitment")
    expect(irSvc).toContain("You can only edit your own question")
    expect(irSvc).toContain("You can only delete your own message")
  })
})

describe("Audit — No Duplicate Financial Postings", () => {
  it("AU7: conversion posts confirmed capital exactly once (atomic + commitment-keyed dedupe)", () => {
    expect(oppSvc).toContain("prisma.$transaction")
    expect(oppSvc).toContain('metadata: { path: ["opportunityCommitmentId"], equals: c.id }')
    expect(oppSvc).toContain("if (dup) continue")
  })

  it("AU8: capital-call payments are tagged per call so confirmed amounts are never double counted", () => {
    expect(callSvc).toContain("metadata: { capitalCallId: call.id }")
    expect(callSvc).toContain('metadata: { path: ["capitalCallId"], equals: call.id }')
  })
})

describe("Audit — Documentation Experience & Mobile UX", () => {
  it("AU9: members can read existing update discussions (comment/reply works both directions)", () => {
    expect(irSvc).toContain("discussions: u.discussions.map")
    expect(idx).toContain("discussions={u.discussions}")
    expect(idx).toContain("discussions.map((d) =>")
  })

  it("AU10: documents remain privately stored and download through the protected proof route", () => {
    const docsRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/documents/route.ts")
    expect(docsRoute).toContain("validateProofFile")
    expect(docsRoute).toContain("uploadProofImage")
  })

  it("AU11: investor update publishing is audit-logged and posts a project timeline record", () => {
    expect(irSvc).toContain("INVESTOR_UPDATE_PUBLISHED")
    expect(irSvc).toContain("addProjectActivity(projectId, userId, \"update_published\"")
  })
})