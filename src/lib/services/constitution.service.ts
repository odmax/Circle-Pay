import { prisma } from "@/lib/prisma"
import {
  hasCirclePermission,
  requireCirclePermission,
} from "@/lib/permissions/circle-permissions"
import type { CirclePermission } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import {
  createNotification,
  notifyCircleMembers,
} from "@/lib/services/notification.service"
import type {
  ConstitutionStatus,
  ConstitutionAmendmentStatus,
  ConstitutionConflictStatus,
} from "@/generated/prisma"

export interface ConstitutionClause {
  key: string
  title: string
  category: string
  text: string
  rules?: Record<string, unknown>
}

export interface ConstitutionContent {
  clauses: ConstitutionClause[]
}

const VERSION_ACCESS: Record<ConstitutionStatus, { view: CirclePermission; manage: CirclePermission }> = {
  DRAFT: { view: "CONSTITUTION_VIEW", manage: "CONSTITUTION_MANAGE" },
  PUBLISHED: { view: "CONSTITUTION_VIEW", manage: "CONSTITUTION_MANAGE" },
  ACTIVE: { view: "CONSTITUTION_VIEW", manage: "CONSTITUTION_MANAGE" },
  SUPERSEDED: { view: "CONSTITUTION_VIEW", manage: "CONSTITUTION_MANAGE" },
}

async function getConstitutionOrCreate(circleId: string, createdById: string) {
  const existing = await prisma.constitution.findUnique({ where: { circleId } })
  if (existing) return existing
  return prisma.constitution.create({
    data: { circleId, createdById },
  })
}

function normalizeContent(content: unknown): ConstitutionContent {
  if (content && typeof content === "object" && Array.isArray((content as ConstitutionContent).clauses)) {
    return content as ConstitutionContent
  }
  return { clauses: [] }
}

/**
 * Get the currently ACTIVE (or latest PUBLISHED/ACTIVE) version for a circle.
 */
export async function getActiveVersion(circleId: string) {
  const constitution = await prisma.constitution.findUnique({ where: { circleId } })
  if (!constitution) return null
  if (constitution.activeVersionId) {
    const active = await prisma.constitutionVersion.findUnique({
      where: { id: constitution.activeVersionId },
    })
    if (active) return active
  }
  return prisma.constitutionVersion.findFirst({
    where: { constitutionId: constitution.id, status: "ACTIVE" },
    orderBy: { version: "desc" },
  })
}

export interface ConstitutionOverviewFull {
  exists: true
  id: string
  title: string
  preamble: string | null
  active: {
    id: string
    version: number
    status: ConstitutionStatus
    effectiveDate: Date | null
    activatedAt: Date | null
    publishedAt: Date | null
    activated: boolean
  } | null
  clauses: ConstitutionClause[]
  memberCount: number
  acceptedCount: number
  percentage: number
  conflictCount: number
  myAcceptance: Date | null
  permissions: {
    canView: boolean
    canPublish: boolean
    canManage: boolean
    canAcceptanceView: boolean
    canAmend: boolean
    canResolve: boolean
  }
}

export type ConstitutionOverview =
  | { exists: false; active: null }
  | ConstitutionOverviewFull

export async function getConstitutionOverview(
  circleId: string,
  userId: string
): Promise<ConstitutionOverview> {
  const constitution = await prisma.constitution.findUnique({ where: { circleId } })
  const active = await getActiveVersion(circleId)

  const canView =
    constitution &&
    (await hasCirclePermission({ userId, circleId, permission: "CONSTITUTION_VIEW" }))
  if (!constitution || !canView) {
    return { exists: false, active: null }
  }

  const memberCount = await prisma.circleMember.count({ where: { circleId } })
  const accepted = active
    ? await prisma.constitutionAcceptance.count({ where: { versionId: active.id } })
    : 0
  const clauses = active ? normalizeContent(active.content).clauses : []
  const conflictCount = await prisma.constitutionRuleConflict.count({
    where: { circleId, status: { in: ["OPEN", "PENDING_REVIEW"] } },
  })

  let myAcceptance: Date | null = null
  if (active) {
    const mine = await prisma.constitutionAcceptance.findUnique({
      where: { versionId_userId: { versionId: active.id, userId } },
    })
    if (mine) myAcceptance = mine.acceptedAt
  }

  const canPublish = await hasCirclePermission({ userId, circleId, permission: "CONSTITUTION_PUBLISH" })
  const canManage = await hasCirclePermission({ userId, circleId, permission: "CONSTITUTION_MANAGE" })
  const canAcceptanceView = await hasCirclePermission({ userId, circleId, permission: "CONSTITUTION_ACCEPTANCE_VIEW" })
  const canAmend = await hasCirclePermission({ userId, circleId, permission: "CONSTITUTION_AMEND" })
  const canResolve = await hasCirclePermission({ userId, circleId, permission: "CONSTITUTION_CONFLICT_RESOLVE" })

  return {
    exists: true,
    id: constitution.id,
    title: constitution.title,
    preamble: constitution.preamble,
    active: active
      ? {
          id: active.id,
          version: active.version,
          status: active.status,
          effectiveDate: active.effectiveDate,
          activatedAt: active.activatedAt,
          publishedAt: active.publishedAt,
          activated: !!constitution.activeVersionId,
        }
      : null,
    clauses,
    memberCount,
    acceptedCount: accepted,
    percentage: memberCount > 0 ? Math.round((accepted / memberCount) * 100) : 0,
    conflictCount,
    myAcceptance,
    permissions: { canView, canPublish, canManage, canAcceptanceView, canAmend, canResolve },
  }
}

export async function listVersionSummaries(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_VIEW" })
  const constitution = await prisma.constitution.findUnique({ where: { circleId } })
  if (!constitution) return []
  const versions = await prisma.constitutionVersion.findMany({
    where: { constitutionId: constitution.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      effectiveDate: true,
      publishedAt: true,
      activatedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
      _count: { select: { acceptances: true } },
    },
  })
  return versions
}

export async function getVersion(circleId: string, versionId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_VIEW" })
  const version = await prisma.constitutionVersion.findUnique({
    where: { id: versionId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      amendments: {
        orderBy: { createdAt: "desc" },
        include: { proposer: { select: { id: true, name: true } } },
      },
    },
  })
  if (!version) throw new Error("Version not found")
  const constitution = await prisma.constitution.findUnique({ where: { id: version.constitutionId } })
  if (!constitution || constitution.circleId !== circleId) throw new Error("Version not in circle")
  return version
}

export async function createDraftVersion({
  circleId,
  userId,
  content,
  title,
  preamble,
}: {
  circleId: string
  userId: string
  content: ConstitutionContent
  title?: string
  preamble?: string | null
}) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_MANAGE" })
  const constitution = await getConstitutionOrCreate(circleId, userId)
  const last = await prisma.constitutionVersion.findFirst({
    where: { constitutionId: constitution.id },
    orderBy: { version: "desc" },
    select: { version: true },
  })
  const versionNumber = (last?.version ?? 0) + 1

  const version = await prisma.constitutionVersion.create({
    data: {
      constitutionId: constitution.id,
      version: versionNumber,
      status: "DRAFT",
      content: content as unknown as object,
      createdById: userId,
    },
  })

  if (title) await prisma.constitution.update({ where: { id: constitution.id }, data: { title } })
  if (preamble !== undefined) await prisma.constitution.update({ where: { id: constitution.id }, data: { preamble } })

  await createAuditLog({
    userId,
    circleId,
    action: "CONSTITUTION_VERSION_CREATED",
    entityType: "ConstitutionVersion",
    entityId: version.id,
    newValues: { version: versionNumber, status: "DRAFT", clauseCount: normalizeContent(content).clauses.length },
  })

  return version
}

export async function updateDraftVersion({
  circleId,
  userId,
  versionId,
  content,
  title,
  preamble,
}: {
  circleId: string
  userId: string
  versionId: string
  content: ConstitutionContent
  title?: string
  preamble?: string | null
}) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_MANAGE" })
  const version = await getVersion(circleId, versionId, userId)
  if (version.status !== "DRAFT") throw new Error("Only draft versions can be edited")
  const updated = await prisma.constitutionVersion.update({
    where: { id: versionId },
    data: { content: content as unknown as object },
  })
  const constitution = await prisma.constitution.findUnique({ where: { id: version.constitutionId } })
  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = title
  if (preamble !== undefined) updateData.preamble = preamble
  if (Object.keys(updateData).length && constitution) {
    await prisma.constitution.update({ where: { id: constitution.id }, data: updateData })
  }
  await createAuditLog({
    userId,
    circleId,
    action: "CONSTITUTION_VERSION_EDITED",
    entityType: "ConstitutionVersion",
    entityId: versionId,
    oldValues: { content: version.content },
    newValues: { content: updated.content },
  })
  return updated
}

export async function publishVersion({
  circleId,
  userId,
  versionId,
}: {
  circleId: string
  userId: string
  versionId: string
}) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_PUBLISH" })
  const version = await getVersion(circleId, versionId, userId)
  if (version.status !== "DRAFT") throw new Error("Only draft versions can be published")
  const updated = await prisma.constitutionVersion.update({
    where: { id: versionId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  })
  await createAuditLog({
    userId,
    circleId,
    action: "CONSTITUTION_VERSION_PUBLISHED",
    entityType: "ConstitutionVersion",
    entityId: versionId,
    newValues: { version: version.version, status: "PUBLISHED" },
  })
  return updated
}

/**
 * Extract executable rule settings from a constitution's clauses. Rules are
 * declared per-clause under `rules` keyed by rule name.
 */
export function extractRuleSettings(content: unknown): { key: string; value: unknown; sourceClause: string }[] {
  const parsed = normalizeContent(content)
  const settings: { key: string; value: unknown; sourceClause: string }[] = []
  const seen = new Set<string>()
  for (const clause of parsed.clauses) {
    const rules = clause.rules ?? {}
    for (const [key, value] of Object.entries(rules)) {
      if (seen.has(key)) continue
      seen.add(key)
      settings.push({ key, value, sourceClause: clause.key })
    }
  }
  return settings
}

/**
 * Activate a published version: supersede the previous ACTIVE version (if any),
 * set this as active, and populate executable rule settings. Immutable once active.
 */
export async function activateVersion({
  circleId,
  userId,
  versionId,
  effectiveDate,
}: {
  circleId: string
  userId: string
  versionId: string
  effectiveDate?: Date
}) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_PUBLISH" })
  const version = await getVersion(circleId, versionId, userId)
  if (version.status !== "PUBLISHED") throw new Error("Only published versions can be activated")
  const constitution = await prisma.constitution.findUnique({ where: { id: version.constitutionId } })
  if (!constitution || constitution.circleId !== circleId) throw new Error("Version not in circle")

  const priorActive = await prisma.constitutionVersion.findFirst({
    where: { constitutionId: constitution.id, status: "ACTIVE" },
  })

  const result = await prisma.$transaction(async (tx) => {
    if (priorActive && priorActive.id !== versionId) {
      await tx.constitutionVersion.update({
        where: { id: priorActive.id },
        data: { status: "SUPERSEDED", supersededAt: new Date(), supersededById: versionId },
      })
    }
    await tx.constitution.update({
      where: { id: constitution.id },
      data: { activeVersionId: versionId },
    })
    const active = await tx.constitutionVersion.update({
      where: { id: versionId },
      data: { status: "ACTIVE", activatedAt: new Date(), effectiveDate: effectiveDate ?? new Date() },
    })

    await tx.constitutionRuleSetting.deleteMany({ where: { constitutionId: constitution.id } })
    const settings = extractRuleSettings(active.content)
    if (settings.length) {
      await tx.constitutionRuleSetting.createMany({
        data: settings.map((s) => ({
          constitutionId: constitution.id,
          versionId: versionId,
          key: s.key,
          ruleType: "constitution-rule",
          valueType: inferValueType(s.value),
          value: s.value as object,
          sourceClause: s.sourceClause,
        })),
      })
    }
    return active
  })

  await createAuditLog({
    userId,
    circleId,
    action: "CONSTITUTION_VERSION_ACTIVATED",
    entityType: "ConstitutionVersion",
    entityId: versionId,
    oldValues: priorActive ? { supersededVersion: priorActive.version } : null,
    newValues: { version: version.version, status: "ACTIVE", effectiveDate: effectiveDate ?? new Date().toISOString() },
  })

  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { settings: true } })
  const existingSettings = (circle?.settings ?? {}) as Record<string, unknown>
  const clash = assessConflicts(result.content, existingSettings)
  if (clash.length) {
    await prisma.constitutionRuleConflict.createMany({
      data: clash.map((c) => ({
        circleId,
        ruleKey: c.ruleKey,
        ruleSource: "CONSTITUTION",
        constitutionValue: c.constitutionValue as object,
        settingKey: c.settingKey,
        settingValue: c.settingValue as object,
        status: "OPEN",
      })),
    })
    await createConflictNotifications(circleId, userId, clash.length)
  }

  const members = await prisma.circleMember.findMany({
    where: { circleId, NOT: { userId } },
    select: { userId: true },
  })
  if (members.length) {
    await notifyCircleMembers(circleId, userId, {
      type: "CONSTITUTION_ACCEPTANCE_REQUIRED",
      title: "New constitution active",
      message: `Version ${version.version} of the constitution is now active. Please review and accept.`,
      link: `/circles/${circleId}/constitution`,
    })
  }

  return result
}

function inferValueType(value: unknown): "NUMBER" | "BOOLEAN" | "STRING" | "ENUM" | "JSON" {
  if (typeof value === "number") return "NUMBER"
  if (typeof value === "boolean") return "BOOLEAN"
  if (typeof value === "string") return "STRING"
  return "JSON"
}

async function createConflictNotifications(circleId: string, excludeUserId: string, count: number) {
  const members = await prisma.circleMember.findMany({
    where: { circleId, NOT: { userId: excludeUserId } },
    select: { userId: true },
  })
  if (!members.length) return
  await notifyCircleMembers(circleId, excludeUserId, {
    type: "CONSTITUTION_CONFLICT_DETECTED",
    title: "Constitution rule conflict detected",
    message: `${count} conflict${count > 1 ? "s" : ""} detected between the constitution and circle settings.`,
    link: `/circles/${circleId}/constitution?tab=conflicts`,
  })
}

export async function acceptVersion({
  circleId,
  userId,
  versionId,
}: {
  circleId: string
  userId: string
  versionId: string
}) {
  const isMember = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId } },
  })
  if (!isMember) throw new Error("Not a member")
  const version = await prisma.constitutionVersion.findUnique({ where: { id: versionId } })
  if (!version) throw new Error("Version not found")
  const constitution = await prisma.constitution.findUnique({
    where: { id: version.constitutionId },
  })
  if (!constitution || constitution.circleId !== circleId) throw new Error("Version not in circle")
  if (version.status !== "ACTIVE") throw new Error("Only the active version can be accepted")

  const existing = await prisma.constitutionAcceptance.findUnique({
    where: { versionId_userId: { versionId, userId } },
  })
  if (existing) return existing

  const acceptance = await prisma.constitutionAcceptance.create({
    data: { versionId, userId },
  })

  await createAuditLog({
    userId,
    circleId,
    action: "CONSTITUTION_ACCEPTED",
    entityType: "ConstitutionAcceptance",
    entityId: acceptance.id,
    newValues: { version: version.version },
  })

  return acceptance
}

export async function hasAccepted(circleId: string, userId: string): Promise<boolean> {
  const active = await getActiveVersion(circleId)
  if (!active) return false
  const acceptance = await prisma.constitutionAcceptance.findUnique({
    where: { versionId_userId: { versionId: active.id, userId } },
  })
  return !!acceptance
}

export async function listAcceptances(circleId: string, userId: string, versionId?: string) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_ACCEPTANCE_VIEW" })
  const active = versionId ? null : await getActiveVersion(circleId)
  const vId = versionId ?? active?.id
  if (!vId) return []
  const members = await prisma.circleMember.findMany({
    where: { circleId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })
  const acceptances = await prisma.constitutionAcceptance.findMany({
    where: { versionId: vId },
    select: { userId: true, acceptedAt: true },
  })
  const acceptedSet = new Map(acceptances.map((a) => [a.userId, a.acceptedAt]))
  return members.map((m) => ({
    userId: m.user.id,
    name: m.user.name ?? m.user.email,
    email: m.user.email,
    role: m.role,
    accepted: acceptedSet.has(m.userId),
    acceptedAt: acceptedSet.get(m.userId) ?? null,
  }))
}

export async function proposeAmendment({
  circleId,
  userId,
  versionId,
  clauseKey,
  clauseTitle,
  oldValue,
  newValue,
  reason,
}: {
  circleId: string
  userId: string
  versionId: string
  clauseKey: string
  clauseTitle?: string
  oldValue?: unknown
  newValue: unknown
  reason?: string
}) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_AMEND" })
  const version = await getVersion(circleId, versionId, userId)
  if (version.status !== "ACTIVE") throw new Error("Only the active version can be amended")

  const amendment = await prisma.constitutionAmendment.create({
    data: {
      versionId,
      circleId,
      clauseKey,
      clauseTitle: clauseTitle ?? null,
      oldValue: oldValue !== undefined ? (oldValue as object) : undefined,
      newValue: newValue as object,
      reason: reason ?? null,
      proposerId: userId,
      status: "PROPOSED",
    },
  })

  await createAuditLog({
    userId,
    circleId,
    action: "CONSTITUTION_AMENDMENT_PROPOSED",
    entityType: "ConstitutionAmendment",
    entityId: amendment.id,
    newValues: { version: version.version, clauseKey, reason },
  })

  const members = await prisma.circleMember.findMany({
    where: { circleId, NOT: { userId } },
    select: { userId: true },
  })
  if (members.length) {
    await notifyCircleMembers(circleId, userId, {
      type: "CONSTITUTION_AMENDMENT_PROPOSED",
      title: "Constitution amendment proposed",
      message: `An amendment to clause "${clauseKey}" has been proposed for review.`,
      link: `/circles/${circleId}/constitution?amendment=${amendment.id}`,
    })
  }

  return amendment
}

export async function reviewAmendment({
  circleId,
  userId,
  amendmentId,
  decision,
  reason,
}: {
  circleId: string
  userId: string
  amendmentId: string
  decision: "APPROVED" | "REJECTED"
  reason?: string
}) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_AMEND" })
  const amendment = await prisma.constitutionAmendment.findUnique({ where: { id: amendmentId } })
  if (!amendment || amendment.circleId !== circleId) throw new Error("Amendment not found")
  if (amendment.status !== "PROPOSED") throw new Error("Amendment already reviewed")

  const version = await prisma.constitutionVersion.findUnique({ where: { id: amendment.versionId } })
  const updated = await prisma.constitutionAmendment.update({
    where: { id: amendmentId },
    data: { status: decision, effectiveDate: decision === "APPROVED" ? new Date() : undefined },
  })

  await createAuditLog({
    userId,
    circleId,
    action: decision === "APPROVED" ? "CONSTITUTION_AMENDMENT_APPROVED" : "CONSTITUTION_AMENDMENT_REJECTED",
    entityType: "ConstitutionAmendment",
    entityId: amendmentId,
    reason: reason ?? null,
    oldValues: { status: "PROPOSED" },
    newValues: { status: decision },
  })

  if (version) {
    const proposer = amendment.proposerId
    await createNotification({
      userId: proposer,
      circleId,
      type: decision === "APPROVED" ? "CONSTITUTION_AMENDMENT_APPROVED" : "CONSTITUTION_AMENDMENT_REJECTED",
      title: decision === "APPROVED" ? "Amendment approved" : "Amendment rejected",
      message: `Your amendment to clause "${amendment.clauseKey}" was ${decision.toLowerCase()}.`,
      link: `/circles/${circleId}/constitution`,
    })
  }

  return updated
}

export async function getConflicts(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_VIEW" })
  return prisma.constitutionRuleConflict.findMany({
    where: { circleId },
    orderBy: { createdAt: "desc" },
  })
}

export async function resolveConflict({
  circleId,
  userId,
  conflictId,
  resolution,
  action,
}: {
  circleId: string
  userId: string
  conflictId: string
  resolution: unknown
  action: string
}) {
  await requireCirclePermission({ userId, circleId, permission: "CONSTITUTION_CONFLICT_RESOLVE" })
  const conflict = await prisma.constitutionRuleConflict.findUnique({ where: { id: conflictId } })
  if (!conflict || conflict.circleId !== circleId) throw new Error("Conflict not found")

  const updated = await prisma.constitutionRuleConflict.update({
    where: { id: conflictId },
    data: {
      status: "RESOLVED",
      resolution: resolution as object,
      resolvedById: userId,
      resolvedAt: new Date(),
      resolvedAction: action,
    },
  })

  await createAuditLog({
    userId,
    circleId,
    action: "CONSTITUTION_CONFLICT_RESOLVED",
    entityType: "ConstitutionRuleConflict",
    entityId: conflictId,
    reason: action,
    oldValues: { status: conflict.status },
    newValues: { status: "RESOLVED", resolution },
  })

  return updated
}

export function assessConflicts(
  content: unknown,
  existingSettings: Record<string, unknown>
): { ruleKey: string; constitutionValue: unknown; settingKey: string; settingValue: unknown }[] {
  const parsed = normalizeContent(content)
  const conflicts: { ruleKey: string; constitutionValue: unknown; settingKey: string; settingValue: unknown }[] = []
  for (const clause of parsed.clauses) {
    const rules = clause.rules ?? {}
    for (const [key, value] of Object.entries(rules)) {
      if (typeof value === "object" && value !== null && !(value as { strict?: boolean }).strict) continue
      const settingName = `constitution.${key}`
      if (settingName in existingSettings && existingSettings[settingName] !== value) {
        conflicts.push({
          ruleKey: key,
          constitutionValue: value,
          settingKey: settingName,
          settingValue: existingSettings[settingName],
        })
      }
    }
  }
  return conflicts
}
