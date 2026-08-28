import { prisma } from "@/lib/prisma"
import { getActiveVersion } from "@/lib/services/constitution.service"
import { createAuditLog } from "@/lib/services/audit.service"

/**
 * Executable rules engine. Reads the rule settings derived from the ACTIVE
 * constitution and exposes typed getters that downstream engines (contributions,
 * payouts, voting, membership) query. All rules default to being "off" when no
 * active constitution exists so existing behaviour is preserved.
 */

export interface ConstitutionRules {
  contribution: {
    enabled: boolean
    amount: number | null
    frequencyDays: number | null
    dueDay: number | null
    gracePeriodDays: number | null
    lateFeePercent: number | null
    maxMissedPeriods: number | null
    allowOverpayment: boolean
    minContributionRequired: boolean
  }
  payout: {
    enabled: boolean
    requiresApproval: boolean
    requiredApprovals: number | null
    minCompliancePercent: number | null
    eligibleAfterCycles: number | null
    requiresBeneficiaryConfirmation: boolean
    allowSkipDefer: boolean
  }
  voting: {
    enabled: boolean
    quorumPercent: number | null
    thresholdPercent: number | null
    anonymousVoteAllowed: boolean
    majorFinancialThreshold: number | null
    amendmentThreshold: number | null
  }
  meeting: {
    enabled: boolean
    noticePeriodDays: number | null
    quorumPercent: number | null
  }
  membership: {
    enabled: boolean
    exitNoticeDays: number | null
    missedPaymentReviewEnabled: boolean
    autoSuspendAfterMissed: number | null
  }
  conflictPreference: "CONSTITUTION" | "CIRCLE_SETTINGS" | "PREFERRED"
}

const DEFAULT_RULES: ConstitutionRules = {
  contribution: {
    enabled: false,
    amount: null,
    frequencyDays: null,
    dueDay: null,
    gracePeriodDays: null,
    lateFeePercent: null,
    maxMissedPeriods: null,
    allowOverpayment: true,
    minContributionRequired: false,
  },
  payout: {
    enabled: false,
    requiresApproval: false,
    requiredApprovals: null,
    minCompliancePercent: null,
    eligibleAfterCycles: null,
    requiresBeneficiaryConfirmation: false,
    allowSkipDefer: true,
  },
  voting: {
    enabled: false,
    quorumPercent: null,
    thresholdPercent: null,
    anonymousVoteAllowed: false,
    majorFinancialThreshold: null,
    amendmentThreshold: null,
  },
  meeting: {
    enabled: false,
    noticePeriodDays: null,
    quorumPercent: null,
  },
  membership: {
    enabled: false,
    exitNoticeDays: null,
    missedPaymentReviewEnabled: false,
    autoSuspendAfterMissed: null,
  },
  conflictPreference: "CONSTITUTION",
}

type NestedRules = Record<string, Record<string, unknown>>

export async function getConstitutionRules(circleId: string): Promise<ConstitutionRules> {
  const active = await getActiveVersion(circleId)
  if (!active) return DEFAULT_RULES

  const settings = await prisma.constitutionRuleSetting.findMany({
    where: { constitutionId: active.constitutionId },
  })

  const map: Record<string, unknown> = {}
  for (const s of settings) map[s.key] = s.value

  const contribution = (map["contribution"] ?? {}) as Record<string, unknown>
  const payout = (map["payout"] ?? {}) as Record<string, unknown>
  const voting = (map["voting"] ?? {}) as Record<string, unknown>
  const meeting = (map["meeting"] ?? {}) as Record<string, unknown>
  const membership = (map["membership"] ?? {}) as Record<string, unknown>

  const rules: ConstitutionRules = {
    contribution: {
      ...DEFAULT_RULES.contribution,
      ...coerceNumbers(contribution, ["amount", "frequencyDays", "dueDay", "gracePeriodDays", "lateFeePercent", "maxMissedPeriods"]),
      enabled: asBool(contribution["enabled"]),
      allowOverpayment: asBool(contribution["allowOverpayment"], true),
      minContributionRequired: asBool(contribution["minContributionRequired"]),
    },
    payout: {
      ...DEFAULT_RULES.payout,
      ...coerceNumbers(payout, ["minCompliancePercent", "eligibleAfterCycles", "requiredApprovals"]),
      enabled: asBool(payout["enabled"]),
      requiresApproval: asBool(payout["requiresApproval"]),
      requiresBeneficiaryConfirmation: asBool(payout["requiresBeneficiaryConfirmation"]),
      allowSkipDefer: asBool(payout["allowSkipDefer"], true),
    },
    voting: {
      ...DEFAULT_RULES.voting,
      ...coerceNumbers(voting, ["quorumPercent", "thresholdPercent", "majorFinancialThreshold", "amendmentThreshold"]),
      enabled: asBool(voting["enabled"]),
      anonymousVoteAllowed: asBool(voting["anonymousVoteAllowed"]),
    },
    meeting: {
      ...DEFAULT_RULES.meeting,
      ...coerceNumbers(meeting, ["noticePeriodDays", "quorumPercent"]),
      enabled: asBool(meeting["enabled"]),
    },
    membership: {
      ...DEFAULT_RULES.membership,
      ...coerceNumbers(membership, ["exitNoticeDays", "autoSuspendAfterMissed"]),
      enabled: asBool(membership["enabled"]),
      missedPaymentReviewEnabled: asBool(membership["missedPaymentReviewEnabled"]),
    },
    conflictPreference: asString(map["conflictPreference"]) as ConstitutionRules["conflictPreference"],
  }

  return rules
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value
  if (value === true || value === "true" || value === "TRUE") return true
  return fallback
}

function asNumber(value: unknown, fallback?: number): number | undefined {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asString(value: unknown, fallback = "CONSTITUTION"): string {
  return typeof value === "string" ? value : fallback
}

function coerceNumbers(obj: Record<string, unknown>, keys: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      const n = asNumber(obj[k])
      out[k] = n === undefined ? null : n
    }
  }
  return out
}

/** Contribution compliance per a member: has the min been met for the current cycle? */
export type ContributionCompliance = {
  contributionEnforced: boolean
  minAmount: number | null
  gracePeriodDays: number | null
  lateFeePercent: number | null
  isCompliant: boolean
  reason: string | null
}

export function evaluateContributionCompliance(
  rules: Pick<ConstitutionRules, "contribution">,
  paidAmount: number,
  requiredAmount?: number
): ContributionCompliance {
  const c = rules.contribution
  if (!c.enabled) {
    return { contributionEnforced: false, minAmount: null, gracePeriodDays: null, lateFeePercent: null, isCompliant: true, reason: null }
  }
  const min = c.amount ?? requiredAmount ?? null
  if (min == null) {
    return { contributionEnforced: true, minAmount: null, gracePeriodDays: c.gracePeriodDays, lateFeePercent: c.lateFeePercent, isCompliant: true, reason: null }
  }
  const compliant = paidAmount >= min
  return {
    contributionEnforced: true,
    minAmount: min,
    gracePeriodDays: c.gracePeriodDays,
    lateFeePercent: c.lateFeePercent,
    isCompliant: compliant,
    reason: compliant ? null : `Minimum contribution of ${min} not met`,
  }
}

/** Effective contribution parameters mandated by the active constitution. */
export type ContributionEnforcement = {
  contributionEnforced: boolean
  amount: number | null
  frequencyDays: number | null
  dueDay: number | null
  gracePeriodDays: number | null
  lateFeePercent: number | null
  maxMissedPeriods: number | null
}

export function getContributionEnforcement(
  rules: Pick<ConstitutionRules, "contribution">
): ContributionEnforcement {
  const c = rules.contribution
  return {
    contributionEnforced: c.enabled,
    amount: c.enabled ? c.amount : null,
    frequencyDays: c.enabled ? c.frequencyDays : null,
    dueDay: c.enabled ? c.dueDay : null,
    gracePeriodDays: c.enabled ? c.gracePeriodDays : null,
    lateFeePercent: c.enabled ? c.lateFeePercent : null,
    maxMissedPeriods: c.enabled ? c.maxMissedPeriods : null,
  }
}

export type ContributionScheduleConflict = {
  field: "amount" | "frequencyDays" | "dueDay" | "gracePeriodDays" | "lateFeePercent"
  constitutionValue: number | null
  scheduleValue: number | null
}

export function evaluateContributionScheduleConflict(
  rules: Pick<ConstitutionRules, "contribution">,
  schedule: {
    amount: number
    frequencyDays: number | null
    dueDay: number | null
    gracePeriodDays: number | null
    lateFeePercent: number | null
  }
): ContributionScheduleConflict[] {
  const enforced = getContributionEnforcement(rules)
  if (!enforced.contributionEnforced) return []

  const conflicts: ContributionScheduleConflict[] = []
  const check = (
    field: ContributionScheduleConflict["field"],
    constitutionValue: number | null,
    scheduleValue: number | null
  ) => {
    if (constitutionValue != null && scheduleValue != null && constitutionValue !== scheduleValue) {
      conflicts.push({ field, constitutionValue, scheduleValue })
    }
  }
  check("amount", enforced.amount, schedule.amount)
  check("frequencyDays", enforced.frequencyDays, schedule.frequencyDays)
  check("dueDay", enforced.dueDay, schedule.dueDay)
  check("gracePeriodDays", enforced.gracePeriodDays, schedule.gracePeriodDays)
  check("lateFeePercent", enforced.lateFeePercent, schedule.lateFeePercent)
  return conflicts
}

/** Payout readiness gating based on constitution compliance rules. */
export type PayoutCompliance = {
  payoutEnforced: boolean
  requiresApproval: boolean
  requiredApprovals: number | null
  minCompliancePercent: number | null
  eligibleAfterCycles: number | null
  requiresBeneficiaryConfirmation: boolean
  allowSkipDefer: boolean
  isEligible: boolean
  reason: string | null
}

export function evaluatePayoutCompliance(
  rules: Pick<ConstitutionRules, "payout">,
  input: { compliancePercent: number; completedCycles: number }
): PayoutCompliance {
  const p = rules.payout
  if (!p.enabled) {
    return {
      payoutEnforced: false,
      requiresApproval: false,
      requiredApprovals: null,
      minCompliancePercent: null,
      eligibleAfterCycles: null,
      requiresBeneficiaryConfirmation: false,
      allowSkipDefer: true,
      isEligible: true,
      reason: null,
    }
  }
  const failures: string[] = []
  let eligible = true
  if (p.minCompliancePercent != null && input.compliancePercent < p.minCompliancePercent) {
    eligible = false
    failures.push(`Minimum ${p.minCompliancePercent}% compliance required`)
  }
  if (p.eligibleAfterCycles != null && input.completedCycles < p.eligibleAfterCycles) {
    eligible = false
    failures.push(`Must complete ${p.eligibleAfterCycles} cycle(s) first`)
  }
  return {
    payoutEnforced: true,
    requiresApproval: p.requiresApproval,
    requiredApprovals: p.requiredApprovals,
    minCompliancePercent: p.minCompliancePercent,
    eligibleAfterCycles: p.eligibleAfterCycles,
    requiresBeneficiaryConfirmation: p.requiresBeneficiaryConfirmation,
    allowSkipDefer: p.allowSkipDefer,
    isEligible: eligible,
    reason: failures.length ? failures.join("; ") : null,
  }
}

export type VotingCompliance = {
  votingEnforced: boolean
  quorumPercent: number | null
  thresholdPercent: number | null
  quorumMet: boolean
  thresholdMet: boolean
  reason: string | null
}

export function evaluateVotingCompliance(
  rules: Pick<ConstitutionRules, "voting">,
  input: { totalMembers: number; votesCast: number; votesFor: number }
): VotingCompliance {
  const v = rules.voting
  if (!v.enabled) {
    return { votingEnforced: false, quorumPercent: null, thresholdPercent: null, quorumMet: true, thresholdMet: true, reason: null }
  }
  const quorum = v.quorumPercent ?? 50
  const threshold = v.thresholdPercent ?? 50
  const quorumMet = input.totalMembers === 0 || (input.votesCast / input.totalMembers) * 100 >= quorum
  const thresholdMet = input.votesCast === 0 || (input.votesFor / input.votesCast) * 100 >= threshold
  const reasons: string[] = []
  if (!quorumMet) reasons.push(`Quorum of ${quorum}% not met`)
  if (!thresholdMet) reasons.push(`Approval threshold of ${threshold}% not met`)
  return {
    votingEnforced: true,
    quorumPercent: quorum,
    thresholdPercent: threshold,
    quorumMet,
    thresholdMet,
    reason: reasons.length ? reasons.join("; ") : null,
  }
}

/**
 * Governance vote enforcement. Applies constitution quorum, approval threshold,
 * amendment-specific and major-financial thresholds, and anonymous-vote rules.
 * The chosen threshold depends on the motion category, so a simple majority is
 * never sufficient when the constitution requires a higher amendment/financial bar.
 */
export type GovernanceVoteCompliance = {
  votingEnforced: boolean
  quorumPercent: number | null
  quorumMet: boolean
  thresholdPercent: number | null
  thresholdMet: boolean
  anonymousAllowed: boolean
  reason: string | null
}

export function evaluateGovernanceVoteCompliance(
  rules: Pick<ConstitutionRules, "voting">,
  input: {
    totalMembers: number
    votesCast: number
    votesFor: number
    motionCategory: string
    isAnonymous: boolean
  }
): GovernanceVoteCompliance {
  const v = rules.voting
  if (!v.enabled) {
    return { votingEnforced: false, quorumPercent: null, quorumMet: true, thresholdPercent: null, thresholdMet: true, anonymousAllowed: true, reason: null }
  }
  const quorum = v.quorumPercent ?? 50
  let threshold = v.thresholdPercent ?? 50
  if (input.motionCategory === "CONSTITUTION_AMENDMENT" && v.amendmentThreshold != null) {
    threshold = v.amendmentThreshold
  }
  if (
    (input.motionCategory === "FINANCIAL" || input.motionCategory === "PAYOUT_EXCEPTION") &&
    v.majorFinancialThreshold != null
  ) {
    threshold = v.majorFinancialThreshold
  }
  const quorumMet = input.totalMembers === 0 || (input.votesCast / input.totalMembers) * 100 >= quorum
  const thresholdMet = input.votesCast === 0 || (input.votesFor / input.votesCast) * 100 >= threshold
  const anonymousAllowed = !input.isAnonymous || v.anonymousVoteAllowed === true
  const reasons: string[] = []
  if (!quorumMet) reasons.push(`Quorum of ${quorum}% not met`)
  if (!thresholdMet) reasons.push(`Approval threshold of ${threshold}% not met`)
  if (!anonymousAllowed) reasons.push("Anonymous voting is not permitted by the constitution")
  return {
    votingEnforced: true,
    quorumPercent: quorum,
    quorumMet,
    thresholdPercent: threshold,
    thresholdMet,
    anonymousAllowed,
    reason: reasons.length ? reasons.join("; ") : null,
  }
}

export type MembershipCompliance = {
  membershipEnforced: boolean
  exitNoticeDays: number | null
  missedPaymentReviewEnabled: boolean
  autoSuspendAfterMissed: number | null
  exitNoticeMet: boolean
  reason: string | null
}

export function evaluateMembershipCompliance(
  rules: Pick<ConstitutionRules, "membership">,
  input: { noticeDaysGiven: number }
): MembershipCompliance {
  const m = rules.membership
  if (!m.enabled) {
    return { membershipEnforced: false, exitNoticeDays: null, missedPaymentReviewEnabled: false, autoSuspendAfterMissed: null, exitNoticeMet: true, reason: null }
  }
  const noticeMet = m.exitNoticeDays == null || input.noticeDaysGiven >= m.exitNoticeDays
  return {
    membershipEnforced: true,
    exitNoticeDays: m.exitNoticeDays,
    missedPaymentReviewEnabled: m.missedPaymentReviewEnabled,
    autoSuspendAfterMissed: m.autoSuspendAfterMissed,
    exitNoticeMet: noticeMet,
    reason: noticeMet ? null : `Exit requires ${m.exitNoticeDays} days notice`,
  }
}

/** High-level per-circle enforcement block used by the dashboard. */
export async function getEnforcementSummary(circleId: string) {
  const rules = await getConstitutionRules(circleId)
  return rules
}

const FREQUENCY_DAYS: Record<string, number | null> = {
  WEEKLY: 7,
  FORTNIGHTLY: 14,
  MONTHLY: 30,
  QUARTERLY: 91,
  ANNUALLY: 365,
  CUSTOM: 30,
}

/**
 * Detect whether an existing contribution schedule conflicts with the active
 * constitution's contribution rules and record OPEN conflicts (surfaced to
 * unauthorized resolution). It never silently overwrites the schedule — the
 * conflict must be explicitly resolved by an authorized user.
 */
export async function detectAndRecordContributionScheduleConflicts(
  circleId: string,
  schedule: {
    id?: string
    amount: number
    frequency: string
    dueDay: number | null
    gracePeriodDays: number | null
    lateFee: number | null
  },
  actorId: string
): Promise<void> {
  const rules = await getConstitutionRules(circleId)
  const enforced = getContributionEnforcement(rules)
  if (!enforced.contributionEnforced) return

  const scheduleFrequencyDays = FREQUENCY_DAYS[schedule.frequency] ?? null

  const conflicts = evaluateContributionScheduleConflict(rules, {
    amount: Number(schedule.amount),
    frequencyDays: scheduleFrequencyDays,
    dueDay: schedule.dueDay,
    gracePeriodDays: schedule.gracePeriodDays,
    lateFeePercent: schedule.lateFee,
  })

  for (const c of conflicts) {
    const settingKey = `contributionSchedule.${c.field}`
    const existing = await prisma.constitutionRuleConflict.findFirst({
      where: {
        circleId,
        ruleKey: `contribution.${c.field}`,
        settingKey,
        settingValue: c.scheduleValue as unknown as object,
      },
    })
    if (existing && existing.status !== "RESOLVED") continue

    await prisma.constitutionRuleConflict.create({
      data: {
        circleId,
        ruleKey: `contribution.${c.field}`,
        ruleSource: "CONSTITUTION",
        constitutionValue: c.constitutionValue as unknown as object,
        settingKey,
        settingValue: c.scheduleValue as unknown as object,
        status: "OPEN",
      },
    })
    await createAuditLog({
      userId: actorId,
      circleId,
      action: "CONSTITUTION_CONFLICT_DETECTED",
      entityType: "ConstitutionRuleConflict",
      entityId: schedule.id ?? null,
      reason: `Contribution schedule conflicts with constitution rule ${c.field}`,
      newValues: { field: c.field, constitutionValue: c.constitutionValue, scheduleValue: c.scheduleValue },
    })
  }
}

export type { NestedRules }
