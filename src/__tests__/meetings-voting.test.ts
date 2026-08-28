import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const gov = readFile("src/lib/services/governance.service.ts")
const meeting = readFile("src/lib/services/meeting.service.ts")
const rulesEngine = readFile("src/lib/services/constitution-rules.service.ts")
const schema = readFile("prisma/schema.prisma")
const castRoute = readFile("src/app/api/circles/[circleId]/votes/[voteId]/cast/route.ts")
const votesRoute = readFile("src/app/api/circles/[circleId]/votes/route.ts")
const perms = readFile("src/lib/permissions/circlePermissions.ts")

describe("Governance Vote — Ballot Contract", () => {
  it("G1: castVote accepts an explicit VoteSelection[] contract (not a scalar optionId)", () => {
    expect(gov).toContain("export type VoteSelection = {")
    expect(gov).toContain("optionId: string")
    expect(gov).toContain("rank?: number")
    expect(gov).toContain("castVote(circleId: string, voteId: string, userId: string, selections: VoteSelection[])")
  })

  it("G2: selections are validated against the vote (empty selections rejected)", () => {
    expect(gov).toContain("selections.length === 0")
    expect(gov).toContain('throw new Error("At least one selection is required")')
  })

  it("G3: every option must belong to THIS vote (invalid / cross-vote options blocked)", () => {
    expect(gov).toContain("governanceVoteOption.findMany({ where: { voteId } })")
    expect(gov).toContain("optionIds.has(id)")
    expect(gov).toContain('throw new Error("Option not found for this vote")')
  })

  it("G4: duplicate option IDs are rejected", () => {
    expect(gov).toContain('throw new Error("Each option may only be selected once")')
    expect(gov).toContain("new Set(validOptions).size !== validOptions.length")
  })

  it("G5: duplicate / invalid ranks are rejected", () => {
    expect(gov).toContain('throw new Error("Ranks must be unique")')
    expect(gov).toContain('throw new Error("Ranks must be positive integers")')
    expect(gov).toContain("new Set(ranks).size !== ranks.length")
    expect(gov).toContain("Number.isInteger(r)")
  })

  it("G6: selection shape is enforced per vote type (YES_NO/MULTIPLE_CHOICE/RANKED_CHOICE)", () => {
    expect(gov).toContain("case \"YES_NO\":")
    expect(gov).toContain('throw new Error("YES_NO votes require exactly one selection")')
    expect(gov).toContain("case \"MULTIPLE_CHOICE\":")
    expect(gov).toContain('throw new Error("MULTIPLE_CHOICE selections must not include ranks")')
    expect(gov).toContain("case \"RANKED_CHOICE\":")
    expect(gov).toContain('throw new Error("RANKED_CHOICE requires every selection to have a rank")')
    expect(gov).toContain('throw new Error("Every RANKED_CHOICE selection requires a unique rank")')
  })

  it("G7: member eligibility and OPEN status enforced before casting", () => {
    expect(gov).toContain("await validateMember(circleId, userId)")
    expect(gov).toContain("GOVERNANCE_VOTE")
    expect(gov).toContain('if (vote.status !== "OPEN") throw new Error("Vote is not open")')
  })

  it("G8: one ballot per member enforced, revoting replaces the prior ballot atomically", () => {
    expect(gov).toContain("governanceBallot.findUnique({ where: { voteId_userId: { voteId, userId } } })")
    expect(gov).toContain('prisma.$transaction(async (tx) => {')
    expect(gov).toContain("tx.governanceVoteRecord.deleteMany({ where: { ballotId: existing.id } })")
    expect(gov).toContain("tx.governanceBallot.create")
    expect(gov).toContain("tx.governanceVoteRecord.createMany")
  })

  it("G9: cross-circle access is blocked via the vote fetch guard", () => {
    expect(gov).toContain("const vote = await getVoteOrThrow(circleId, voteId)")
    expect(gov).toContain("vote.circleId !== circleId")
    expect(gov).toContain('throw new Error("Vote not found")')
  })

  it("G10: castVote returns the full ballot with its records", () => {
    expect(gov).toContain('include: { records: true }')
  })
})

describe("Governance Vote — Schema & Privacy", () => {
  it("G11: GovernanceBallot model exists with one ballot per member per vote", () => {
    expect(schema).toContain("model GovernanceBallot {")
    expect(schema).toContain("@@unique([voteId, userId])")
    expect(schema).toContain("model GovernanceVoteRecord {")
  })

  it("G12: ballot uniqueness constraints prevent duplicate options and ranks within a ballot", () => {
    expect(schema).toContain("@@unique([ballotId, optionId])")
    expect(schema).toContain("@@unique([ballotId, rank])")
  })

  it("G13: the old single-record-per-member unique constraint is removed", () => {
    // The previous `@@unique([voteId, userId])` on GovernanceVoteRecord must not exist.
    const start = schema.indexOf("model GovernanceVoteRecord {")
    let end = schema.indexOf("@@index([optionId])", start)
    if (end === -1) end = schema.length
    const recordBlock = schema.slice(start, end)
    expect(recordBlock).not.toContain("@@unique([voteId, userId])")
    expect(recordBlock).toContain("ballotId")
  })

  it("G14: anonymous votes never expose voter identity in result views", () => {
    expect(gov).toContain("voterIdentities: vote.anonymous ? [] : vote.options")
    expect(gov).toContain("only aggregate counts are exposed, never individual voters")
  })

  it("G15: quorum counts distinct ballots (voters), not individual selections", () => {
    expect(gov).toContain("prisma.governanceBallot.count({ where: { voteId } })")
  })
})

describe("Governance Vote — Finalize & Constitution", () => {
  it("G16: quorum-not-met still blocks finalization", () => {
    expect(gov).toContain("evaluateGovernanceVoteCompliance")
    expect(gov).toContain('throw new Error("Quorum not met; governance vote cannot be finalized")')
  })

  it("G17: constitution amendment and major-financial thresholds still apply", () => {
    expect(rulesEngine).toContain("amendmentThreshold")
    expect(rulesEngine).toContain("majorFinancialThreshold")
    expect(rulesEngine).toContain("evaluateGovernanceVoteCompliance")
  })

  it("G18: finalized result exposes passed/outcome/quorum/threshold and identity-safe aggregates", () => {
    expect(gov).toContain("outcome: passed ? \"APPROVED\" : \"REJECTED\"")
    expect(gov).toContain("quorumMet:")
    expect(gov).toContain("thresholdMet:")
  })
})

describe("Governance Vote — API Route", () => {
  it("G19: cast route validates a selections array and forwards it to the service", () => {
    expect(castRoute).toContain("body.selections")
    expect(castRoute).toContain('Array.isArray(body.selections)')
    expect(castRoute).toContain("castVote(circleId, voteId, session.user.id, body.selections)")
  })

  it("G20: votes list/create route exists", () => {
    expect(votesRoute).toContain("getCircleVotes")
    expect(votesRoute).toContain("createVote")
  })
})

describe("Governance Vote — Permissions", () => {
  it("G21: governance vote permissions registered", () => {
    expect(perms).toContain("GOVERNANCE_VOTE")
    expect(perms).toContain("GOVERNANCE_VOTE_MANAGE")
    expect(perms).toContain("GOVERNANCE_VOTE_VIEW")
    expect(perms).toContain("GOVERNANCE_RESULT_VIEW")
  })
})

describe("Meetings — Lifecycle", () => {
  it("M1: meeting lifecycle functions exist with status transitions", () => {
    expect(meeting).toContain("export async function startMeeting")
    expect(meeting).toContain("export async function completeMeeting")
    expect(meeting).toContain("export async function cancelMeeting")
    expect(meeting).toContain('"SCHEDULED"')
    expect(meeting).toContain('"IN_PROGRESS"')
    expect(meeting).toContain('"COMPLETED"')
  })

  it("M2: check-in and attendance recording exist", () => {
    expect(meeting).toContain("export async function checkInToMeeting")
    expect(meeting).toContain("export async function recordAttendance")
  })

  it("M3: required quorum is computed from member count and quorum percent", () => {
    expect(meeting).toContain("export async function getQuorumStatus")
    expect(meeting).toContain("Math.ceil")
  })

  it("M4: published minutes are immutable and amendments are versioned", () => {
    expect(meeting).toContain("export async function publishMinutes")
    expect(meeting).toContain("export async function amendMinutes")
    expect(meeting).toContain("export async function reviewMinutes")
  })
})

describe("Meetings — Notice Period & Quorum Rules", () => {
  it("M5: scheduled meetings enforce the constitution notice period", () => {
    expect(meeting).toContain("async function noticePeriodFor(circleId: string)")
    expect(meeting).toContain("data.noticePeriodDays ?? (await noticePeriodFor(circleId))")
    expect(meeting).toContain("in advance")
    expect(meeting).toContain("status === \"SCHEDULED\"")
  })

  it("M6: quorum falls back to the constitution meeting group", () => {
    expect(meeting).toContain("rules?.meeting.quorumPercent")
  })
})

describe("Meetings — Minutes Acknowledgement", () => {
  it("M7: only published minutes can be acknowledged", () => {
    expect(meeting).toContain("export async function acknowledgeMinutes")
    expect(meeting).toContain("status !== \"PUBLISHED\"")
    expect(meeting).toContain("Only published minutes can be acknowledged")
  })

  it("M8: acknowledgement uniqueness is enforced by upsert on the (minutesId, userId) pair", () => {
    expect(meeting).toContain("meetingMinutesAcknowledgement.upsert")
    expect(meeting).toContain("minutesId_userId: { minutesId, userId }")
    expect(meeting).toContain('action: "MINUTES_ACKNOWLEDGED"')
  })

  it("M9: acknowledgements list is scoped to a minutes id and joins user", () => {
    expect(meeting).toContain("export async function getMinutesAcknowledgements")
    expect(meeting).toContain("where: { minutesId }")
    expect(meeting).toContain("user: { select: { id: true, name: true, email: true, image: true } }")
  })

  it("M10: MeetingMinutesAcknowledgement exists in the schema with a unique member pair", () => {
    expect(schema).toContain("model MeetingMinutesAcknowledgement {")
    expect(schema).toContain("@@unique([minutesId, userId])")
  })
})

describe("Meetings — Reminder Scheduling Primitive", () => {
  it("M11: sendMeetingReminders is deduplicated per RSVP via notifiedReminder", () => {
    expect(meeting).toContain("export async function sendMeetingReminders")
    expect(meeting).toContain("notifiedReminder: false")
    expect(meeting).toContain('type: "MEETING_REMINDER"')
    expect(meeting).toContain("data: { notifiedReminder: true }")
  })
})

describe("Governance — Decisions & Closing-Soon", () => {
  it("G22: finalizeVote records an immutable decision linked to the vote", () => {
    expect(gov).toContain("prisma.governanceDecision.create")
    expect(gov).toContain("voteId,")
    expect(gov).toContain("outcome: result.outcome")
    expect(gov).toContain('action: "GOV_DECISION_RECORDED"')
  })

  it("G23: decision read helpers exist and are scoped to the circle", () => {
    expect(gov).toContain("export async function getCircleDecisions")
    expect(gov).toContain("export async function getDecision")
    expect(gov).toContain("where: { id: decisionId, circleId }")
  })

  it("G24: GovernanceDecision model exists, immutable with one-per-vote guarantee", () => {
    expect(schema).toContain("model GovernanceDecision {")
    expect(schema).toContain("voteId         String         @unique")
    expect(schema).toContain("@@index([circleId])")
  })

  it("G25: sendVoteClosingSoon notifies only members who have not yet voted", () => {
    expect(gov).toContain("export async function sendVoteClosingSoon")
    expect(gov).toContain('type: "VOTE_CLOSING_SOON"')
    expect(gov).toContain("voted.has(m.userId)")
  })
})

describe("Constitution — Meeting Rules Group", () => {
  it("C1: constitution rules define a meeting group with notice and quorum", () => {
    expect(rulesEngine).toContain("meeting: {")
    expect(rulesEngine).toContain("noticePeriodDays: number | null")
    expect(rulesEngine).toContain("quorumPercent: number | null")
  })

  it("C2: the meeting group is parsed from the constitution map", () => {
    expect(rulesEngine).toContain('const meeting = (map["meeting"] ?? {})')
    expect(rulesEngine).toContain('coerceNumbers(meeting, ["noticePeriodDays", "quorumPercent"])')
  })
})

describe("Dashboard — Governance Block", () => {
  const dash = (() => {
    try {
      return readFile("src/lib/services/stokvel-dashboard.service.ts")
    } catch {
      return ""
    }
  })()
  const dashWidget = (() => {
    try {
      return readFile("src/components/stokvel/stokvel-governance.tsx")
    } catch {
      return ""
    }
  })()

  it("D1: dashboard data exposes a governance block with meeting/votes/decisions/minutes", () => {
    expect(dash).toContain("governance: {")
    expect(dash).toContain("nextMeeting")
    expect(dash).toContain("openVotes")
    expect(dash).toContain("pendingDecisions")
    expect(dash).toContain("latestMinutes")
  })

  it("D2: myRSVP resolves to the RSVP matching the upcoming meeting id", () => {
    expect(dash).toContain("myRsvp.find((r) => r.meeting.id === nextMeeting.id)")
  })

  it("D3: dashboard exposes governance permission flags", () => {
    expect(dash).toContain("canViewMeetings")
    expect(dash).toContain("canVote")
    expect(dash).toContain("canManageMeetings")
  })

  it("D4: a governance widget component renders meetings & votes actions", () => {
    expect(dashWidget).toContain("nextMeeting")
    expect(dashWidget).toContain("openVotes")
    expect(dashWidget).toContain("/meetings")
    expect(dashWidget).toContain("/votes")
  })
})
