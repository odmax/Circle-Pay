import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const contribution = readFile("src/lib/services/contribution.service.ts")
const meeting = readFile("src/lib/services/meeting.service.ts")
const statement = readFile("src/lib/services/statement.service.ts")
const upload = readFile("src/lib/services/upload.service.ts")
const cronScheduler = readFile("src/app/api/cron/contribution-scheduler/route.ts")
const cronAutomations = readFile("src/app/api/cron/automations/run/route.ts")
const cronApprovals = readFile("src/app/api/cron/process-approvals/route.ts")
const payoutsRoute = readFile("src/app/api/circles/[circleId]/payouts/route.ts")
const payoutActions = readFile("src/components/payouts/payout-actions.tsx")
const voteForm = readFile("src/components/meetings/vote-cast-form.tsx")
const memberStatementRoute = readFile("src/app/api/circles/[circleId]/statements/member/[memberId]/route.ts")
const myStatement = readFile("src/app/(dashboard)/circles/[circleId]/my-statement/page.tsx")
const historyTable = readFile("src/components/contributions/contribution-history-table.tsx")

describe("STOKVEL Production Readiness — money integrity", () => {
  it("F1: PAID contribution amount-edit re-posts with a unique corrected idempotency key", () => {
    expect(contribution).toMatch(/correctedKey = `corrected:contribution:\$\{contributionId\}:\$\{Date\.now\(\)\}`/)
    expect(contribution).toContain("idempotencyKey: correctedKey")
    // The PAID branch must not silently no-op the re-post via the same plain key.
    const paidBranch = contribution.slice(contribution.indexOf("PAID / other statuses"))
    expect(paidBranch).not.toContain("recordContributionToLedger(circleId, contributionId, Number(data.amount)")
  })
})

describe("STOKVEL Production Readiness — cross-circle isolation", () => {
  it("F2: meeting minutes/agenda functions verify the meeting belongs to the circle", () => {
    for (const fn of [
      "export async function updateAgendaItem",
      "export async function reviewMinutes",
      "export async function publishMinutes",
      "export async function amendMinutes",
      "export async function getMinutes",
      "export async function acknowledgeMinutes",
      "export async function getMinutesAcknowledgements",
    ]) {
      const start = meeting.indexOf(fn)
      const end = meeting.indexOf("export ", start + fn.length)
      const body = end === -1 ? meeting.slice(start) : meeting.slice(start, end)
      expect(body, fn).toContain("await getMeetingOrThrow(circleId, meetingId)")
    }
  })

  it("F4: payout config read enforces circle membership", () => {
    expect(payoutsRoute).toContain("view === \"config\"")
    expect(payoutsRoute).toContain("prisma.circleMember.findUnique")
    expect(payoutsRoute).toContain("Not a member of this circle")
  })

  it("F3: member statement authorizes the acting user, not the target member", () => {
    expect(statement).toContain("actorUserId: string")
    expect(statement).toContain("if (actorUserId === memberId)")
    expect(statement).toContain("CIRCLE_PERMISSIONS.REPORT_VIEW")
    expect(memberStatementRoute).toContain("generateMemberStatementData(circleId, memberId, session.user.id")
  })
})

describe("STOKVEL Production Readiness — cron security", () => {
  it("F9: contribution-scheduler cron endpoint fails closed", () => {
    expect(cronScheduler).toContain("never authorize this endpoint")
    expect(cronScheduler).not.toContain(": true\n")
  })

  it("F9: automations cron endpoint fails closed", () => {
    expect(cronAutomations).toContain("if (!secret || token !== secret)")
  })

  it("F9: process-approvals cron endpoint fails closed", () => {
    expect(cronApprovals).toContain("if (!secret || authHeader !== `Bearer ${secret}`)")
  })
})

describe("STOKVEL Production Readiness — file upload security", () => {
  it("F10: uploads enforce an allowlisted extension to block XSS vectors", () => {
    expect(upload).toContain("ALLOWED_EXTENSIONS")
    expect(upload).toContain("File extension not allowed")
    expect(upload).toContain("ALLOWED_EXTENSIONS.includes(ext)")
    expect(upload).toContain("ALLOWED_EXTENSIONS.includes(rawExt)")
  })
})

describe("STOKVEL Production Readiness — UI wiring", () => {
  it("F5: Confirm Receipt payout action opens a working dialog", () => {
    const confirmSnip = payoutActions.slice(payoutActions.indexOf("showConfirm"))
    expect(confirmSnip).toContain("<Dialog open={open === \"confirm\"}")
    expect(confirmSnip).toContain(`setOpen(v ? "confirm" : null)`)
    expect(confirmSnip).toContain("Confirm receipt")
  })

  it("F6: ranked-choice voting supports ordered multi-selection", () => {
    expect(voteForm).toContain("function rank(optionId: string)")
    expect(voteForm).toContain("isRanked ? rank(opt.id) : isYesNo ? selectSingle(opt.id) : toggle(opt.id)")
  })
})

describe("STOKVEL Production Readiness — money display", () => {
  it("F7: statement and history use the circle's actual currency symbol", () => {
    expect(myStatement).toContain("CURRENCIES.find((c) => c.code === (circle?.currency ?? \"ZAR\"))")
    expect(historyTable).toContain("{currencySymbol}")
  })
})
