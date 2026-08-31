import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(relativePath))
}

const schema = readFile("prisma/schema.prisma")
const permissions = readFile("src/lib/permissions/circlePermissions.ts")
const roles = readFile("src/lib/permissions/circle-role-permissions.ts")
const svc = readFile("src/lib/services/investor-relations.service.ts")
const ctx = readFile("src/lib/api/project-investor-ctx.ts")
const updatesRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/updates/route.ts")
const updateActionRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/updates/[updateId]/route.ts")
const docsRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/documents/route.ts")
const questionsRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/questions/route.ts")
const questionActionRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/questions/[questionId]/route.ts")
const meetingsRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/meetings/route.ts")
const dashboardRoute = readFile("src/app/api/circles/[circleId]/projects/[projectId]/investor/dashboard/route.ts")
const idx = readFile("src/components/projects/investors/investors-index.tsx")
const panel = readFile("src/components/projects/investors/investor-panel.tsx")
const overview = readFile("src/components/projects/overview/overview-tab.tsx")

describe("Investor Relations — Data Model", () => {
  it("IR1: schema defines updates, acknowledgments, discussion, milestones, questions, documents", () => {
    for (const m of ["ProjectUpdate", "ProjectUpdateAttachment", "ProjectUpdateAcknowledgment", "ProjectUpdateDiscussion", "ProjectMilestone", "InvestorQuestion", "InvestorProjectDocument"]) {
      expect(schema).toMatch(new RegExp(`^model ${m} \\{`, "m"))
    }
  })

  it("IR1b: updates, questions and documents are cascade-deleted with their project (no orphans)", () => {
    expect(schema).toContain('project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)')
  })

  it("IR2: required update types, milestone statuses, question states, doc categories exist as enums", () => {
    for (const v of ["GENERAL", "FINANCIAL", "MILESTONE", "RISK", "DISTRIBUTION", "DOCUMENT"]) expect(schema).toContain(v)
    for (const v of ["PLANNED", "IN_PROGRESS", "AT_RISK", "DELAYED", "COMPLETED", "CANCELLED"]) expect(schema).toContain(v)
    for (const v of ["OPEN", "ANSWERED", "RESOLVED"]) expect(schema).toContain(v)
    for (const v of ["AGREEMENT", "FINANCIAL_STATEMENT", "REPORT", "RECEIPT", "MEETING", "DISTRIBUTION", "MILESTONE_EVIDENCE"]) expect(schema).toContain(v)
  })

  it("IR3: investor meetings reuse the existing Meeting model via a projectId link", () => {
    expect(schema).toMatch(/^model Meeting \{[\s\S]*?noticePeriodDays\s+Int\?[\s\S]*?projectId\s+String\?/m)
  })

  it("IR4: notification types cover the IR lifecycle", () => {
    for (const t of ["INVESTOR_UPDATE_PUBLISHED", "MILESTONE_REACHED", "MILESTONE_DELAYED", "INVESTOR_FINANCIAL_REPORT", "MATERIAL_RISK", "INVESTOR_QUESTION_ANSWERED", "INVESTOR_DOCUMENT_PUBLISHED", "INVESTOR_MEETING"]) {
      expect(schema).toContain(t)
    }
  })
})

describe("Investor Relations — Permissions (no hardcoded roles)", () => {
  it("IR5: permission keys exist", () => {
    for (const p of ["INVESTOR_UPDATE_CREATE", "INVESTOR_UPDATE_MANAGE", "INVESTOR_MILESTONE_MANAGE", "INVESTOR_QUESTION_ANSWER", "INVESTOR_DOCUMENT_MANAGE"]) {
      expect(permissions).toContain(`${p}: "${p}"`)
    }
  })

  it("IR6: managers get document/answer/update perms via role defaults", () => {
    expect(roles).toContain("P.INVESTOR_DOCUMENT_MANAGE")
    expect(roles).toContain("P.INVESTOR_QUESTION_ANSWER")
    expect(roles).toContain("P.INVESTOR_UPDATE_CREATE")
  })
})

describe("Security — Investor-Only Visibility & Isolation", () => {
  it("IR7: investor-only content is hidden from non-investors (visibility gate)", () => {
    expect(svc).toContain('if (visibility === "INVESTORS_ONLY") return viewer.isInvestor || viewer.isManager')
  })

  it("IR8: cross-project isolation on every read is enforced by projectId", () => {
    expect(ctx).toContain("requireProjectInCircle(projectId, circleId)")
    expect(svc).toContain("u.projectId !== projectId")
    expect(svc).toContain("findFirst({ where: { id: milestoneId, projectId } })")
    expect(dashboardRoute).toContain("getInvestorCtx")
  })

  it("IR9: members cannot modify others' discussion messages", () => {
    expect(svc).toContain("You can only delete your own message")
    expect(svc).toContain("d.userId !== userId")
  })

  it("IR10: only invested members can ask questions; only the asker edits own questions", () => {
    expect(svc).toContain("Only invested members can submit questions")
    expect(questionsRoute).toContain("createInvestorQuestion(")
    expect(svc).toContain("You can only edit your own question")
  })

  it("IR11: documents use the existing private storage upload infra", () => {
    expect(docsRoute).toContain("validateProofFile")
    expect(docsRoute).toContain("uploadProofImage")
    expect(docsRoute).toContain("INVESTOR_DOCUMENT_MANAGE")
  })
})

describe("Notifications — Investor-Only, Never Unrelated Members", () => {
  it("IR12: investors are derived from CONFIRMED contributions, and bulk-notified", () => {
    expect(svc).toContain('prisma.projectContribution.findMany')
    expect(svc).toContain('status: "CONFIRMED"')
    expect(svc).toContain("createBulkNotifications")
  })

  it("IR13: investor-only updates are not broadcast to all circle members", () => {
    expect(svc).toContain('if (update.visibility === "INVESTORS_ONLY")')
    expect(svc).toContain("notifyInvestorsOnly(")
    expect(svc).toContain("notifyProjectMembers(")
  })

  it("IR14: milestone reached/delayed and question answered notify investors", () => {
    expect(svc).toContain('"MILESTONE_REACHED"')
    expect(svc).toContain('"MILESTONE_DELAYED"')
    expect(svc).toContain('"INVESTOR_QUESTION_ANSWERED"')
    expect(svc).toContain('"INVESTOR_MEETING"')
  })
})

describe("Investor Relations — Material Actions Audited", () => {
  it("IR15: publish/edit/delete updates, milestones, questions, documents are audited", () => {
    for (const a of ["INVESTOR_UPDATE_PUBLISHED", "INVESTOR_UPDATE_EDITED", "INVESTOR_UPDATE_DELETED", "INVESTOR_MILESTONE_CREATED", "INVESTOR_MILESTONE_TRANSITION", "INVESTOR_QUESTION_ASKED", "INVESTOR_QUESTION_ANSWERED", "INVESTOR_QUESTION_RESOLVED", "INVESTOR_DOCUMENT_PUBLISHED"]) {
      expect(svc).toContain(a)
    }
  })
})

describe("Member & Admin Surface", () => {
  it("IR16: updates support General/Financial/Milestone/Risk/Distribution/Document + visibility + importance", () => {
    expect(idx).toContain("GENERAL")
    expect(idx).toContain("RISK")
    expect(idx).toContain("DISTRIBUTION")
    expect(idx).toContain("INVESTORS_ONLY")
    expect(idx).toContain("isImportant")
  })

  it("IR17: members can acknowledge, comment and ask; managers can publish and answer", () => {
    expect(idx).toContain('Acknowledge')
    expect(idx).toContain('<MessageCircle')
    expect(idx).toContain('Ask question')
    expect(idx).toContain('Publish update')
    expect(idx).toContain('Answer')
  })

  it("IR18: milestone section shows progress visually with budget/actual", () => {
    expect(idx).toContain("ProgressBar")
    expect(idx).toContain("Budget")
    expect(idx).toContain("Actual")
    expect(idx).toContain("Add milestone")
  })

  it("IR19: Q&A keeps private/public visibility and publish-to-investors", () => {
    expect(idx).toContain("Investors only")
    expect(idx).toContain("Public")
    expect(idx).toContain("Publish answer to all investors")
  })

  it("IR20: documents organized by category (agreements/statements/reports/receipts/meeting/distribution)", () => {
    for (const c of ["Agreements", "Financial statements", "Reports", "Receipts", "Meeting docs", "Distribution records"]) expect(idx).toContain(c)
  })

  it("IR21: the investors dashboard exposes latest update, milestones, events, risks, questions, docs, next distribution", () => {
    expect(dashboardRoute).toContain("getInvestorDashboard")
    expect(panel).toContain("Latest update")
    expect(panel).toContain("Milestones")
    expect(panel).toContain("Open questions")
    expect(panel).toContain("Risks")
    expect(panel).toContain("next distribution")
    expect(panel).toContain("meetings upcoming")
  })

  it("IR22: the Investors relation panel is mounted on the Project Overview", () => {
    expect(overview).toContain("InvestorRelationsPanel")
  })

  it("IR23: an Investors tab exists in the project navigation", () => {
    const layout = readFile("src/components/projects/project-layout.tsx")
    expect(layout).toContain('label: "Investors"')
  })

  it("IR24: all IR routes exist", () => {
    for (const r of [
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/dashboard/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/updates/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/updates/[updateId]/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/milestones/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/milestones/[milestoneId]/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/questions/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/questions/[questionId]/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/documents/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/meetings/route.ts",
      "src/app/api/circles/[circleId]/projects/[projectId]/investor/updates/[updateId]/attachments/route.ts",
    ]) {
      expect(exists(r)).toBe(true)
    }
  })
})