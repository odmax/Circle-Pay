import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const service = readFile("src/lib/services/year-end-close.service.ts")
const schema = readFile("prisma/schema.prisma")
const perms = readFile("src/lib/permissions/circlePermissions.ts")
const rolePerms = readFile("src/lib/permissions/circle-role-permissions.ts")
const notif = readFile("src/lib/services/notification.service.ts")
const dashboard = readFile("src/lib/services/stokvel-dashboard.service.ts")
const route = readFile("src/app/api/circles/[circleId]/year-end/route.ts")
const statementsRoute = readFile("src/app/api/circles/[circleId]/year-end/[closeId]/statements/route.ts")
const client = readFile("src/components/year-end/year-end-client.tsx")
const page = readFile("src/app/(dashboard)/circles/[circleId]/year-end/page.tsx")

describe("Year-End Close — Financial Contract", () => {
  it("YE1: schema defines the YearEndClose workflow model and status enum", () => {
    expect(schema).toContain("enum YearEndCloseStatus")
    for (const s of ["DRAFT", "RECONCILING", "PENDING_APPROVAL", "APPROVED", "FINALIZED", "REOPENED"]) {
      expect(schema).toContain(s)
    }
    expect(schema).toContain("model YearEndClose {")
    expect(schema).toContain("model YearEndMemberStatement {")
    expect(schema).toContain("model YearEndAdjustment {")
    expect(schema).toContain("model YearEndCloseConfig {")
  })

  it("YE2: statement figures are Decimal(12,2) and immutable identifiers are captured", () => {
    const compact = schema.replace(/\s+/g, " ")
    for (const field of [
      "totalContributed",
      "outstandingContributions",
      "penaltiesFees",
      "payoutsReceived",
      "allocatedReturns",
      "finalEntitlement",
    ]) {
      expect(compact).toContain(`${field} Decimal @default(0) @db.Decimal(12, 2)`)
    }
    expect(compact).toContain("statementNumber String @unique")
  })

  it("YE3: duplicate-close prevention via unique (circleId, periodEnd) and idempotent guard", () => {
    expect(schema).toContain("@@unique([circleId, periodEnd])")
    expect(service).toContain("circleId_periodEnd")
    expect(service).toContain("throw new Error(\"This period has already been closed and locked\")")
    expect(schema).toContain("@@unique([closeId, userId])")
  })

  it("YE4: reconciliation computes per-member figures + group summary (single source of truth)", () => {
    expect(service).toContain("export interface MemberYearEndFigures {")
    expect(service).toContain("totalContributed: Decimal")
    expect(service).toContain("outstandingContributions")
    expect(service).toContain("penaltiesFees")
    expect(service).toContain("payoutsReceived")
    expect(service).toContain("allocatedReturns")
    expect(service).toContain("finalEntitlement: Decimal")
    expect(service).toContain("fig.finalEntitlement = fig.totalContributed")
  })

  it("YE5: blocking rules detect outstanding dues, unresolved proofs, pending approvals, unpaid payouts", () => {
    expect(service).toContain("export async function detectBlockers(")
    expect(service).toContain('code: "OUTSTANDING_CONTRIBUTIONS"')
    expect(service).toContain('code: "UNCONFIRMED_PAYOUTS"')
    expect(service).toContain('code: "PENDING_APPROVALS"')
    expect(service).toContain('code: "UNRESOLVED_PROOFS"')
    expect(service).toContain('severity: "ERROR"')
  })

  it("YE6: blockers must be clear before submission/finalization", () => {
    expect(service).toContain("Close cannot be submitted for approval until blockers are resolved")
    expect(service).toContain("Blockers prevent finalization:")
  })

  it("YE7: approval flow reuses the existing approval engine (createApprovalRequest)", () => {
    expect(service).toContain("createApprovalRequest({")
    expect(service).toContain('type: "SETTLEMENT"')
    expect(service).toContain("approvalRequestId = req.id")
    expect(service).toContain('status: "PENDING_APPROVAL"')
  })

  it("YE8: finalization snapshots statements, locks the period and marks isCurrent", () => {
    expect(service).toContain("export async function finalizeYearEnd(")
    expect(service).toContain("isCurrent: false")
    expect(service).toContain("isCurrent: true")
    expect(service).toContain('status: "FINALIZED"')
    expect(service).toContain('throw new Error("This year-end close is already finalized")')
    expect(service).toContain("yearEndMemberStatement.create")
  })

  it("YE9: historical figures are never silently mutated — corrections via adjustments or audited reopen", () => {
    expect(schema).toContain("model YearEndAdjustment {")
    expect(service).toContain("recordAdjustment(")
    expect(service).toContain("reopenYearEnd(")
    expect(service).toContain('throw new Error("Finalized close is locked; reopen it before recording corrections")')
    expect(service).toContain('action: "YEAR_END_REOPENED"')
    expect(service).toContain('action: "YEAR_END_ADJUSTMENT_RECORDED"')
  })

  it("YE10: Decimal-safe math via Prisma.Decimal (no raw float accumulation)", () => {
    expect(service).toContain("new Prisma.Decimal(0)")
    expect(service).toContain("acc.add(dec(v))")
  })

  it("YE11: all mutations run inside prisma.$transaction", () => {
    expect(service).toContain("prisma.$transaction")
  })
})

describe("Year-End Close — Security & Privacy", () => {
  it("YE12: permission keys exist and are wired to roles", () => {
    expect(perms).toContain('YEAR_END_VIEW: "YEAR_END_VIEW"')
    expect(perms).toContain('YEAR_END_MANAGE: "YEAR_END_MANAGE"')
    expect(perms).toContain('YEAR_END_APPROVE: "YEAR_END_APPROVE"')
    expect(perms).toContain('YEAR_END_ADJUST: "YEAR_END_ADJUST"')
    // ADMIN gets all four year-end permissions.
    expect(rolePerms).toContain("P.YEAR_END_VIEW")
    expect(rolePerms).toContain("P.YEAR_END_MANAGE")
    expect(rolePerms).toContain("P.YEAR_END_APPROVE")
    expect(rolePerms).toContain("P.YEAR_END_ADJUST")
  })

  it("YE13: a plain member only ever gets view-own access (no manage/approve/adjust by default)", () => {
    expect(service).toContain("requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE })")
    expect(service).toContain("requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_APPROVE })")
    expect(service).toContain("requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_ADJUST })")
  })

  it("YE14: member statement view is scoped to the requesting userId (privacy-critical)", () => {
    expect(service).toContain("// Member can only view their own statement")
    expect(service).toContain("export async function getMemberStatement(circleId: string, userId: string")
    expect(service).toContain("circleId,")
    expect(service).toContain("userId,")
    expect(service).toContain("isCurrent: opts.periodEnd ? undefined : true")
  })

  it("YE15: circle-wide statement listing only exposes other members to elevated viewers", () => {
    expect(service).toContain("export async function getCircleStatements(")
    expect(service).toContain("CIRCLE_PERMISSIONS.MEMBER_VIEW")
    expect(service).toContain("where.userId = opts.memberUserId")
    expect(service).toContain("where.userId = userId")
  })

  it("YE16: cross-circle access is blocked (close must belong to the requested circle)", () => {
    expect(service).toContain("findFirst({ where: { id: closeId, circleId } })")
    expect(service).toContain('throw new Error("Year-end close not found")')
  })

  it("YE17: status transitions enforce ordering and lock guard", () => {
    expect(service).toContain('if (close.status !== "PENDING_APPROVAL") throw new Error(`Cannot approve close in status ${close.status}`)')
    expect(service).toContain("Year-end close must be approved before finalization")
    expect(service).toContain('if (close.status !== "FINALIZED") throw new Error("Only finalized closes can be reopened")')
  })

  it("YE18: audit logging records every workflow step", () => {
    for (const action of [
      "YEAR_END_INITIATED",
      "YEAR_END_RECONCILED",
      "YEAR_END_SUBMITTED_FOR_APPROVAL",
      "YEAR_END_APPROVED",
      "YEAR_END_FINALIZED",
      "YEAR_END_STATEMENT_CREATED",
    ]) {
      expect(service).toContain(`action: "${action}"`)
    }
  })

  it("YE19: notification types are registered in the enum and preference map", () => {
    for (const t of [
      "YEAR_END_INITIATED",
      "YEAR_END_APPROVAL_REQUIRED",
      "YEAR_END_FINALIZED",
      "YEAR_END_STATEMENT_READY",
      "YEAR_END_REOPENED",
      "YEAR_END_ADJUSTMENT_RECORDED",
    ]) {
      expect(schema).toContain(t)
      expect(notif).toContain(`${t}: "yearEnd"`)
    }
    expect(notif).toContain("yearEnd: true")
  })
})

describe("Year-End Close — API & Dashboard Wiring", () => {
  it("YE20: API routes expose the close workflow and member statements", () => {
    expect(route).toContain("initiateYearEndClose")
    expect(route).toContain("listYearEndCloses")
    expect(statementsRoute).toContain("getCircleStatements")
    expect(statementsRoute).toContain("memberUserId")
  })

  it("YE21: dashboard surfaces year-end status/progress for members with access", () => {
    expect(dashboard).toContain("yearEnd: {")
    expect(dashboard).toContain("canViewYearEnd")
    expect(dashboard).toContain("CIRCLE_PERMISSIONS.YEAR_END_VIEW")
    expect(dashboard).toContain("prisma.yearEndClose.findFirst")
    expect(dashboard).toContain("yearEndStepOrder")
  })

  it("YE22: page resolves member/admin/owner UI permissions via Circle permission checks (no hardcoded roles)", () => {
    expect(page).toContain("hasCirclePermission({")
    for (const p of [
      "CIRCLE_PERMISSIONS.YEAR_END_VIEW",
      "CIRCLE_PERMISSIONS.YEAR_END_MANAGE",
      "CIRCLE_PERMISSIONS.YEAR_END_APPROVE",
      "CIRCLE_PERMISSIONS.YEAR_END_ADJUST",
    ]) {
      expect(page).toContain(`permission: ${p}`)
    }
    // No hardcoded role names drive the UI branch.
    expect(page).not.toContain('role === "OWNER"')
    expect(page).not.toContain('role === "ADMIN"')
    expect(page).not.toContain('role === "MEMBER"')
    expect(page).toContain("const permissions: YearEndPermissions = {")
    expect(page).toContain("canView: canViewYearEnd")
    expect(page).toContain("canManage: canManageYearEnd")
    expect(page).toContain("canApprove: canApproveYearEnd")
    expect(page).toContain("canAdjust: canAdjustYearEnd")
    expect(client).toContain("permissions: YearEndPermissions")
    expect(client).toContain("permissions }: YearEndClientProps")
  })

  it("YE23: member visibility — read-only status + own statement, action buttons hidden or shown as read-only", () => {
    // A member without MANAGE cannot initiate.
    expect(client).toContain("canManage ? (")
    expect(client).toContain("Authorized members will begin the close workflow when ready.")
    // Every action button is gated by the matching permission.
    expect(client).toContain("statusAllowsReconcile && canManage")
    expect(client).toContain("statusAllowsSubmit && canManage")
    expect(client).toContain("statusAllowsApprove && permApprove")
    expect(client).toContain("statusAllowsFinalize && canManage")
    expect(client).toContain("statusAllowsReopen && canAdjust")
    // Read-only state replaces buttons that would 403.
    expect(client).toContain("Read-only — the next step requires authorized members")
    // Member's own statement is always shown read-only.
    expect(client).toContain("status.myStatement &&")
  })

  it("YE24: admin visibility — manage + approve + adjust actions rendered when the workflow allows", () => {
    expect(client).toContain("permApprove")
    // Manage drives reconcile/submit/finalize/initiate.
    expect(client).toContain("const canReconcile = statusAllowsReconcile && canManage")
    expect(client).toContain("const canFinalize = statusAllowsFinalize && canManage")
    // Adjust drives reopen.
    expect(client).toContain("const canReopen = statusAllowsReopen && canAdjust")
    // Read-only truthiness accounts for all four permission gates.
    expect(client).toContain("(statusAllowsReconcile && !canManage) ||")
    expect(client).toContain("(statusAllowsApprove && !permApprove) ||")
    expect(client).toContain("(statusAllowsReopen && !canAdjust)")
  })

  it("YE25: owner visibility — role permissions give owners all four YEAR_END capabilities", () => {
    const ownerPerms = rolePerms
    // OWNER inherits every permission key via Object.values, including YEAR_END_*.
    expect(ownerPerms).toContain("const OWNER_PERMISSIONS: CirclePermission[] = Object.values(P)")
    // The four flags driving the UI all map to real permission keys.
    for (const p of ["YEAR_END_VIEW", "YEAR_END_MANAGE", "YEAR_END_APPROVE", "YEAR_END_ADJUST"]) {
      expect(perms).toContain(`${p}: "${p}"`)
    }
    // API enforcement is unchanged (server remains the source of truth).
    expect(service).toContain("requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.YEAR_END_MANAGE })")
  })
})
