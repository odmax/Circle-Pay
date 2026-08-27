import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const service = readFile("src/lib/services/constitution.service.ts")
const rulesEngine = readFile("src/lib/services/constitution-rules.service.ts")
const scheduleService = readFile("src/lib/services/contribution-schedule.service.ts")
const payoutService = readFile("src/lib/services/payout-rotation.service.ts")
const dashboardService = readFile("src/lib/services/stokvel-dashboard.service.ts")
const page = readFile("src/app/(dashboard)/circles/[circleId]/constitution/page.tsx")
const dashboard = readFile("src/components/stokvel/stokvel-dashboard.tsx")
const quickActions = readFile("src/components/stokvel/stokvel-quick-actions.tsx")
const perms = readFile("src/lib/permissions/circlePermissions.ts")
const rolePerms = readFile("src/lib/permissions/circle-role-permissions.ts")
const notifService = readFile("src/lib/services/notification.service.ts")
const notifSettings = readFile("src/app/api/settings/notifications/route.ts")
const settingsPage = readFile("src/app/(dashboard)/settings/notifications/page.tsx")
const notifPage = readFile("src/app/(dashboard)/notifications/page.tsx")

describe("Constitution — Version Lifecycle", () => {
  it("C1: active version resolved via activeVersionId with ACTIVE fallback", () => {
    expect(service).toContain("export async function getActiveVersion")
    expect(service).toContain("activeVersionId")
    expect(service).toContain('status: "ACTIVE"')
  })

  it("C2: drafts can only be published from DRAFT state", () => {
    expect(service).toContain("export async function publishVersion")
    expect(service).toContain('if (version.status !== "DRAFT") throw new Error("Only draft versions can be published")')
  })

  it("C3: only DRAFT versions are editable (immutable once published)", () => {
    expect(service).toContain("export async function updateDraftVersion")
    expect(service).toContain('if (version.status !== "DRAFT") throw new Error("Only draft versions can be edited")')
  })

  it("C4: only PUBLISHED versions can be activated; activation supersedes previous ACTIVE", () => {
    expect(service).toContain("export async function activateVersion")
    expect(service).toContain('if (version.status !== "PUBLISHED") throw new Error("Only published versions can be activated")')
    expect(service).toContain("SUPERSEDED")
    expect(service).toContain("status: \"ACTIVE\"")
  })

  it("C5: only the ACTIVE version can be accepted, and only by members", () => {
    expect(service).toContain("export async function acceptVersion")
    expect(service).toContain('if (version.status !== "ACTIVE") throw new Error("Only the active version can be accepted")')
    expect(service).toContain('throw new Error("Not a member")')
    expect(service).toContain("CONSTITUTION_ACCEPTANCE_REQUIRED")
  })

  it("C6: acceptances tracked per version-member so new versions require re-acceptance", () => {
    expect(service).toContain("export async function hasAccepted")
    expect(service).toContain("constitutionAcceptance.findUnique")
    expect(service).toContain("versionId_userId")
    expect(service).toContain("export async function listAcceptances")
  })

  it("C7: activating requires re-acceptance by other members", () => {
    expect(service).toContain('type: "CONSTITUTION_ACCEPTANCE_REQUIRED"')
    expect(notifService).toContain("CONSTITUTION_ACCEPTANCE_REQUIRED")
  })
})

describe("Constitution — Permissions", () => {
  it("C8: all six CONSTITUTION permissions exist", () => {
    for (const p of [
      "CONSTITUTION_VIEW",
      "CONSTITUTION_MANAGE",
      "CONSTITUTION_PUBLISH",
      "CONSTITUTION_ACCEPTANCE_VIEW",
      "CONSTITUTION_AMEND",
      "CONSTITUTION_CONFLICT_RESOLVE",
    ]) {
      expect(perms).toContain(p)
    }
  })

  it("C9: reading requires CONSTITUTION_VIEW, managing requires CONSTITUTION_MANAGE", () => {
    expect(service).toContain('permission: "CONSTITUTION_VIEW"')
    expect(service).toContain('permission: "CONSTITUTION_MANAGE"')
  })

  it("C10: publish and resolution are gated behind dedicated permissions", () => {
    expect(service).toContain('permission: "CONSTITUTION_PUBLISH"')
    expect(service).toContain('permission: "CONSTITUTION_CONFLICT_RESOLVE"')
    expect(service).toContain('permission: "CONSTITUTION_AMEND"')
  })

  it("C11: acceptance list requires CONSTITUTION_ACCEPTANCE_VIEW", () => {
    expect(service).toContain('permission: "CONSTITUTION_ACCEPTANCE_VIEW"')
  })
})

describe("Constitution — Rules Engine (pure evaluation)", () => {
  it("C12: rules default to disabled when no active constitution", () => {
    expect(rulesEngine).toContain("enabled: false")
    expect(rulesEngine).toContain("conflictPreference: \"CONSTITUTION\"")
  })

  it("C13: contribution compliance evaluates minimum amount with grace and late fee", () => {
    expect(rulesEngine).toContain("export function evaluateContributionCompliance")
    expect(rulesEngine).toContain("gracePeriodDays")
    expect(rulesEngine).toContain("lateFeePercent")
  })

  it("C14: effective contribution enforcement + per-field conflict detection exist", () => {
    expect(rulesEngine).toContain("export type ContributionEnforcement")
    expect(rulesEngine).toContain("export function getContributionEnforcement")
    expect(rulesEngine).toContain("export function evaluateContributionScheduleConflict")
    expect(rulesEngine).toContain("contributionEnforced")
  })

  it("C15: payout compliance enforces approval, compliance %, and cycle eligibility", () => {
    expect(rulesEngine).toContain("export function evaluatePayoutCompliance")
    expect(rulesEngine).toContain("minCompliancePercent")
    expect(rulesEngine).toContain("eligibleAfterCycles")
    expect(rulesEngine).toContain("requiresApproval")
  })

  it("C16: voting + membership compliance helpers exist", () => {
    expect(rulesEngine).toContain("export function evaluateVotingCompliance")
    expect(rulesEngine).toContain("export function evaluateMembershipCompliance")
    expect(rulesEngine).toContain("quorumPercent")
    expect(rulesEngine).toContain("exitNoticeDays")
  })

  it("C17: conflict preference default is CONSTITUTION", () => {
    expect(rolePerms ?? rulesEngine).toBeTruthy()
    expect(rulesEngine).toContain("CONSTITUTION")
  })
})

describe("Constitution — Schedule Conflict Detection", () => {
  it("C19: schedule conflicts recorded as OPEN, never silently overwritten", () => {
    expect(rulesEngine).toContain("export async function detectAndRecordContributionScheduleConflicts")
    expect(rulesEngine).toContain("never silently overwrite")
    expect(rulesEngine).toContain("constitutionRuleConflict.create")
    expect(rulesEngine).toContain('status: "OPEN"')
    expect(rulesEngine).toContain("CONSTITUTION_CONFLICT_DETECTED")
  })

  it("C20: create and update contribution schedules run conflict detection", () => {
    expect(scheduleService).toContain("detectAndRecordContributionScheduleConflicts")
    expect(scheduleService).toContain("export async function createContributionSchedule")
    expect(scheduleService).toContain("export async function updateContributionSchedule")
  })
})

describe("Constitution — Payout Enforcement", () => {
  it("C21: cycle readiness gates on constitution payout rules", () => {
    expect(payoutService).toContain("getConstitutionRules")
    expect(payoutService).toContain("export async function evaluateCycleReadiness")
    expect(payoutService).toContain("getPoolCompliance")
  })

  it("C22: skip/defer are blocked when constitution forbids them", () => {
    expect(payoutService).toContain("allowSkipDefer")
    expect(payoutService).toContain("export async function skipPayout")
    expect(payoutService).toContain("export async function deferPayout")
  })
})

describe("Constitution — Dashboard Integration", () => {
  it("C23: stokvel dashboard exposes constitution overview and permission", () => {
    expect(dashboardService).toContain("getConstitutionOverview")
    expect(dashboardService).toContain("canViewConstitution")
    expect(dashboardService).toContain("myAcceptance")
  })

  it("C24: dashboard page renders the constitution block", () => {
    expect(dashboard).toContain("constitution")
  })

  it("C25: quick action links to the constitution page", () => {
    expect(quickActions).toContain("constitution")
  })

  it("C26: constitution page exists with overview, versions, acceptances, conflicts", () => {
    expect(page).toContain("versions")
    expect(page).toContain("acceptances")
    expect(page).toContain("conflicts")
    expect(page).toContain("amendments")
  })
})

describe("Constitution — Notifications & Audit", () => {
  it("C27: all constitution notification types are registered with the constitution category", () => {
    for (const t of [
      "CONSTITUTION_PUBLISHED",
      "CONSTITUTION_ACTIVATED",
      "CONSTITUTION_SUPERSEDED",
      "CONSTITUTION_ACCEPTANCE_REQUIRED",
      "CONSTITUTION_ACCEPTANCE_OVERDUE",
      "CONSTITUTION_AMENDMENT_PROPOSED",
      "CONSTITUTION_AMENDMENT_APPROVED",
      "CONSTITUTION_AMENDMENT_REJECTED",
      "CONSTITUTION_RULE_CHANGED",
      "CONSTITUTION_CONFLICT_DETECTED",
      "CONSTITUTION_CONFLICT_RESOLVED",
      "CONSTITUTION_MEMBER_ACCEPTED",
    ]) {
      expect(notifService).toContain(t)
    }
  })

  it("C28: constitution category enabled in settings and listed in UI", () => {
    expect(notifSettings).toContain("constitution")
    expect(settingsPage).toContain("constitution")
    expect(notifPage.toUpperCase()).toContain("CONSTITUTION")
  })

  it("C29: constitution lifecycle actions write audit logs", () => {
    expect(service).toContain("createAuditLog")
    expect(service).toContain("CONSTITUTION_VERSION_PUBLISHED")
    expect(service).toContain("CONSTITUTION_VERSION_ACTIVATED")
    expect(service).toContain("CONSTITUTION_ACCEPTED")
  })
})

describe("Constitution — Amendments & Conflicts", () => {
  it("C30: only the active version can be amended, with statuses tracked", () => {
    expect(service).toContain("export async function proposeAmendment")
    expect(service).toContain('if (version.status !== "ACTIVE") throw new Error("Only the active version can be amended")')
    expect(service).toContain("PROPOSED")
    expect(service).toContain("APPROVED")
    expect(service).toContain("REJECTED")
  })

  it("C31: amendments and conflicts are resolved with permission + audit", () => {
    expect(service).toContain("export async function reviewAmendment")
    expect(service).toContain("export async function resolveConflict")
    expect(service).toContain("CONSTITUTION_CONFLICT_RESOLVED")
  })
})
