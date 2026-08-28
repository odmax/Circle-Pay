import { prisma } from "@/lib/prisma"
import type {
  MeetingStatus,
  MeetingType,
  MeetingRSVPStatus,
  AttendanceStatus,
  AgendaItemStatus,
  ActionItemStatus,
  MeetingMinutesStatus,
  Prisma,
} from "@/generated/prisma"
import { requireCirclePermission, hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { createAuditLog } from "@/lib/services/audit.service"
import { notifyCircleMembers, createNotification } from "@/lib/services/notification.service"
import { getConstitutionRules } from "@/lib/services/constitution-rules.service"

async function validateMember(circleId: string, userId: string) {
  const m = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId } } })
  if (!m) throw new Error("Not a member")
}

async function getMeetingOrThrow(circleId: string, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
  if (!meeting || meeting.circleId !== circleId) throw new Error("Meeting not found")
  return meeting
}

/** Returns quorum rules from the active constitution, falling back to the meeting override. */
async function quorumFor(circleId: string, meeting: { quorumPercent: number | null }) {
  if (meeting.quorumPercent != null) return meeting.quorumPercent
  const rules = await getConstitutionRules(circleId).catch(() => null)
  return rules?.voting.quorumPercent ?? rules?.meeting.quorumPercent ?? null
}

/** Required look-ahead (days) between scheduling and the meeting, per the constitution. */
async function noticePeriodFor(circleId: string): Promise<number | null> {
  const rules = await getConstitutionRules(circleId).catch(() => null)
  const days = rules?.meeting.noticePeriodDays ?? null
  return days != null && days > 0 ? days : null
}

export type CreateMeetingInput = {
  title: string
  description?: string
  type?: string
  scheduledAt: string
  endAt?: string
  location?: string
  isOnline?: boolean
  meetingLink?: string
  agenda?: string
  noticePeriodDays?: number
  attendanceRequirement?: number
  quorumPercent?: number
  status?: string
}

export async function createMeeting(circleId: string, userId: string, data: CreateMeetingInput) {
  await validateMember(circleId, userId)
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_CREATE })

  const status: MeetingStatus = data.status === "SCHEDULED" ? "SCHEDULED" : "DRAFT"

  const scheduledAt = new Date(data.scheduledAt)
  const requiredNotice = data.noticePeriodDays ?? (await noticePeriodFor(circleId))
  if (status === "SCHEDULED" && requiredNotice != null) {
    const minSchedule = Date.now() + requiredNotice * 86400000
    if (scheduledAt.getTime() < minSchedule) {
      throw new Error(`Meeting must be scheduled at least ${requiredNotice} day${requiredNotice === 1 ? "" : "s"} in advance`)
    }
  }

  const constitutionQuorum = data.quorumPercent ?? (await quorumFor(circleId, { quorumPercent: null }))

  const meeting = await prisma.meeting.create({
    data: {
      circleId,
      createdById: userId,
      title: data.title,
      description: data.description,
      type: (data.type || "GENERAL") as MeetingType,
      scheduledAt,
      endAt: data.endAt ? new Date(data.endAt) : null,
      location: data.location,
      isOnline: data.isOnline || false,
      meetingLink: data.meetingLink,
      agenda: data.agenda,
      noticePeriodDays: requiredNotice ?? null,
      attendanceRequirement: data.attendanceRequirement,
      quorumPercent: constitutionQuorum,
      status,
    },
  })

  createAuditLog({ userId, circleId, action: "MEETING_CREATED", entityType: "Meeting", entityId: meeting.id, newValues: { title: meeting.title, status } }).catch(() => {})

  if (status === "SCHEDULED") {
    notifyCircleMembers(circleId, userId, {
      type: "MEETING_SCHEDULED",
      title: `Meeting scheduled: ${meeting.title}`,
      message: new Date(meeting.scheduledAt).toLocaleString(),
      link: `/circles/${circleId}/meetings`,
    }).catch(() => {})
  }

  return meeting
}

export async function updateMeeting(circleId: string, meetingId: string, userId: string, data: Partial<CreateMeetingInput>) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })
  const existing = await getMeetingOrThrow(circleId, meetingId)

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.type !== undefined) updateData.type = data.type as MeetingType
  if (data.scheduledAt !== undefined) updateData.scheduledAt = new Date(data.scheduledAt)
  if (data.endAt !== undefined) updateData.endAt = data.endAt ? new Date(data.endAt) : null
  if (data.location !== undefined) updateData.location = data.location
  if (data.isOnline !== undefined) updateData.isOnline = data.isOnline
  if (data.meetingLink !== undefined) updateData.meetingLink = data.meetingLink
  if (data.agenda !== undefined) updateData.agenda = data.agenda
  if (data.noticePeriodDays !== undefined) updateData.noticePeriodDays = data.noticePeriodDays
  if (data.attendanceRequirement !== undefined) updateData.attendanceRequirement = data.attendanceRequirement
  if (data.quorumPercent !== undefined) updateData.quorumPercent = data.quorumPercent
  if (data.status !== undefined && (data.status === "SCHEDULED" || data.status === "DRAFT")) updateData.status = data.status as MeetingStatus

  const meeting = await prisma.meeting.update({ where: { id: meetingId }, data: updateData })

  createAuditLog({ userId, circleId, action: "MEETING_UPDATED", entityType: "Meeting", entityId: meeting.id, newValues: updateData }).catch(() => {})

  const agendaChanged = data.agenda !== undefined
  if (agendaChanged && meeting.status !== "DRAFT") {
    notifyCircleMembers(circleId, userId, {
      type: "MEETING_AGENDA_UPDATED",
      title: `Agenda updated: ${meeting.title}`,
      message: "The meeting agenda has been updated",
      link: `/circles/${circleId}/meetings/${meeting.id}`,
    }).catch(() => {})
  }

  return meeting
}

export async function cancelMeeting(circleId: string, meetingId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })
  const meeting = await getMeetingOrThrow(circleId, meetingId)
  const updated = await prisma.meeting.update({ where: { id: meetingId }, data: { status: "CANCELLED" } })
  createAuditLog({ userId, circleId, action: "MEETING_CANCELLED", entityType: "Meeting", entityId: meeting.id }).catch(() => {})
  return updated
}

export async function startMeeting(circleId: string, meetingId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })
  const meeting = await getMeetingOrThrow(circleId, meetingId)
  if (meeting.status !== "SCHEDULED") throw new Error("Only scheduled meetings can start")
  return prisma.meeting.update({ where: { id: meetingId }, data: { status: "IN_PROGRESS" } })
}

export async function completeMeeting(circleId: string, meetingId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })
  const meeting = await getMeetingOrThrow(circleId, meetingId)
  if (meeting.status !== "IN_PROGRESS") throw new Error("Only in-progress meetings can be completed")
  return prisma.meeting.update({ where: { id: meetingId }, data: { status: "COMPLETED" } })
}

export async function getCircleMeetings(circleId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_VIEW })
  return prisma.meeting.findMany({
    where: { circleId, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { rsvps: true } },
      rsvps: { select: { userId: true, status: true } },
      attendance: { select: { userId: true, status: true, checkedInAt: true } },
      minutes: { select: { id: true, status: true, publishedAt: true } },
    },
    orderBy: { scheduledAt: "asc" },
  })
}

export async function getMeetingById(circleId: string, meetingId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_VIEW })
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId, circleId },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      rsvps: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      attendance: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      agendaItems: { orderBy: { sortOrder: "asc" } },
      actionItems: { include: { assignee: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      minutes: { include: { versions: { orderBy: { version: "desc" }, take: 5 } } },
      votes: { include: { options: { orderBy: { sortOrder: "asc" } }, _count: { select: { records: true } } } },
    },
  })
  if (!meeting) throw new Error("Meeting not found")
  return meeting
}

export async function rsvpToMeeting(circleId: string, meetingId: string, userId: string, status: MeetingRSVPStatus) {
  await validateMember(circleId, userId)
  const meeting = await getMeetingOrThrow(circleId, meetingId)
  if (meeting.status === "CANCELLED" || meeting.status === "COMPLETED") throw new Error("Meeting is not accepting RSVPs")

  const rsvp = await prisma.meetingRSVP.upsert({
    where: { meetingId_userId: { meetingId, userId } },
    create: { meetingId, userId, status },
    update: { status },
  })

  createAuditLog({ userId, circleId, action: "MEETING_RSVP", entityType: "Meeting", entityId: meetingId, newValues: { status } }).catch(() => {})
  notifyCircleMembers(circleId, userId, {
    type: "MEETING_RSVP_RECEIVED",
    title: `New RSVP for ${meeting.title}`,
    message: "A member updated their meeting RSVP",
    link: `/circles/${circleId}/meetings/${meetingId}`,
  }).catch(() => {})
  return rsvp
}

export async function checkInToMeeting(circleId: string, meetingId: string, userId: string, actorId: string) {
  await validateMember(circleId, userId)
  await requireCirclePermission({ userId: actorId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_CHECK_IN })
  const meeting = await getMeetingOrThrow(circleId, meetingId)
  if (meeting.status !== "IN_PROGRESS" && meeting.status !== "SCHEDULED") throw new Error("Check-in not open")

  const attendance = await prisma.meetingAttendance.upsert({
    where: { meetingId_userId: { meetingId, userId } },
    create: { meetingId, userId, status: "PRESENT", checkedInAt: new Date(), recordedById: actorId },
    update: { status: "PRESENT", checkedInAt: new Date(), recordedById: actorId },
  })

  createAuditLog({ userId: actorId, circleId, action: "MEETING_CHECKED_IN", entityType: "MeetingAttendance", entityId: attendance.id, affectedUserId: userId }).catch(() => {})
  return attendance
}

export async function recordAttendance(
  circleId: string,
  meetingId: string,
  actorId: string,
  entries: { userId: string; status: AttendanceStatus; note?: string }[]
) {
  await requireCirclePermission({ userId: actorId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_ATTENDANCE_MANAGE })
  await getMeetingOrThrow(circleId, meetingId)

  const results = []
  for (const e of entries) {
    const existing = await prisma.meetingAttendance.findUnique({ where: { meetingId_userId: { meetingId, userId: e.userId } } })
    const rec = await prisma.meetingAttendance.upsert({
      where: { meetingId_userId: { meetingId, userId: e.userId } },
      create: { meetingId, userId: e.userId, status: e.status, recordedById: actorId, note: e.note },
      update: { status: e.status, recordedById: actorId, note: e.note ?? existing?.note },
    })
    results.push(rec)
  }

  createAuditLog({ userId: actorId, circleId, action: "MEETING_ATTENDANCE_UPDATED", entityType: "Meeting", entityId: meetingId, newValues: { count: entries.length } }).catch(() => {})

  await evaluateAndLogQuorum(circleId, meetingId, actorId)
  return results
}

/** Live quorum status for a meeting. */
export async function getQuorumStatus(circleId: string, meetingId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_VIEW })
  const meeting = await getMeetingOrThrow(circleId, meetingId)

  const [memberCount, attendance] = await Promise.all([
    prisma.circleMember.count({ where: { circleId } }),
    prisma.meetingAttendance.findMany({ where: { meetingId } }),
  ])

  const present = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length
  const quorumPct = await quorumFor(circleId, meeting)
  const required = quorumPct == null ? null : Math.ceil((memberCount * quorumPct) / 100)

  return {
    memberCount,
    present,
    absent: attendance.filter((a) => a.status === "ABSENT").length,
    excused: attendance.filter((a) => a.status === "EXCUSED").length,
    late: attendance.filter((a) => a.status === "LATE").length,
    quorumPercent: quorumPct,
    required,
    quorumReached: required == null ? false : present >= required,
    membershipThresholdMet: required == null ? false : memberCount > 0 && present >= required,
  }
}

async function evaluateAndLogQuorum(circleId: string, meetingId: string, actorId: string) {
  const meeting = await getMeetingOrThrow(circleId, meetingId)
  const [memberCount, attendance] = await Promise.all([
    prisma.circleMember.count({ where: { circleId } }),
    prisma.meetingAttendance.findMany({ where: { meetingId } }),
  ])
  const present = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length
  const quorumPct = await quorumFor(circleId, meeting)
  const required = quorumPct == null ? null : Math.ceil((memberCount * quorumPct) / 100)
  const reached = required == null ? false : present >= required

  createAuditLog({
    userId: actorId,
    circleId,
    action: reached ? "QUORUM_REACHED" : "QUORUM_LOST",
    entityType: "Meeting",
    entityId: meetingId,
    newValues: { present, required, quorumPercent: quorumPct },
  }).catch(() => {})

  notifyCircleMembers(circleId, actorId, {
    type: reached ? "QUORUM_REACHED" : "QUORUM_LOST",
    title: reached ? "Quorum reached" : "Quorum not reached",
    message: reached ? `Quorum met (${present}/${required} present)` : `Quorum not met (${present}/${required ?? "?"} present)`,
    link: `/circles/${circleId}/meetings/${meetingId}`,
  }).catch(() => {})
}

export async function addAgendaItem(circleId: string, meetingId: string, userId: string, data: { title: string; description?: string; sortOrder?: number }) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })
  await getMeetingOrThrow(circleId, meetingId)
  const item = await prisma.meetingAgendaItem.create({
    data: { meetingId, createdById: userId, title: data.title, description: data.description, sortOrder: data.sortOrder ?? 0 },
  })
  createAuditLog({ userId, circleId, action: "MEETING_AGENDA_UPDATED", entityType: "MeetingAgendaItem", entityId: item.id }).catch(() => {})
  return item
}

export async function updateAgendaItem(circleId: string, meetingId: string, itemId: string, userId: string, data: { title?: string; description?: string; status?: AgendaItemStatus; discussionNotes?: string; decision?: string; sortOrder?: number }) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })
  const item = await prisma.meetingAgendaItem.findFirst({ where: { id: itemId, meetingId } })
  if (!item) throw new Error("Agenda item not found")
  return prisma.meetingAgendaItem.update({ where: { id: itemId }, data })
}

export async function addActionItem(circleId: string, meetingId: string, userId: string, data: { title: string; assigneeId?: string; dueDate?: string }) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MANAGE })
  await getMeetingOrThrow(circleId, meetingId)
  const item = await prisma.meetingActionItem.create({
    data: { meetingId, createdById: userId, title: data.title, assigneeId: data.assigneeId, dueDate: data.dueDate ? new Date(data.dueDate) : null },
  })
  createAuditLog({ userId, circleId, action: "ACTION_ITEM_ASSIGNED", entityType: "MeetingActionItem", entityId: item.id, affectedUserId: data.assigneeId ?? null }).catch(() => {})
  if (data.assigneeId) {
    createNotification({
      userId: data.assigneeId,
      circleId,
      type: "ACTION_ITEM_ASSIGNED",
      title: "Action item assigned to you",
      message: data.title,
      link: `/circles/${circleId}/meetings/${meetingId}`,
    }).catch(() => {})
  }
  return item
}

// ─── Minutes ───────────────────────────────────────────────

export async function generateMinutes(circleId: string, meetingId: string, userId: string, content: Record<string, unknown>) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MINUTES_MANAGE })
  const meeting = await getMeetingOrThrow(circleId, meetingId)
  const existing = await prisma.meetingMinutes.findUnique({ where: { meetingId } })

  const json = { content, generatedAt: new Date().toISOString(), meeting: { title: meeting.title, scheduledAt: meeting.scheduledAt.toISOString() } } as unknown as Prisma.InputJsonValue

  let minutes
  if (existing) {
    minutes = await prisma.meetingMinutes.update({ where: { id: existing.id }, data: { content: json, status: "DRAFT" } })
  } else {
    minutes = await prisma.meetingMinutes.create({ data: { meetingId, createdById: userId, content: json, status: "DRAFT" } })
  }

  await prisma.meetingMinutesVersion.create({
    data: { minutesId: minutes.id, version: 1, content: json, editedById: userId, changeNote: "Initial draft" },
  })
  createAuditLog({ userId, circleId, action: "MEETING_MINUTES_GENERATED", entityType: "MeetingMinutes", entityId: minutes.id }).catch(() => {})
  return minutes
}

export async function reviewMinutes(circleId: string, meetingId: string, minutesId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MINUTES_MANAGE })
  const minutes = await prisma.meetingMinutes.findFirst({ where: { id: minutesId, meetingId } })
  if (!minutes) throw new Error("Minutes not found")
  if (minutes.status === "PUBLISHED") throw new Error("Published minutes are immutable")
  return prisma.meetingMinutes.update({ where: { id: minutesId }, data: { status: "REVIEW" } })
}

export async function publishMinutes(circleId: string, meetingId: string, minutesId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MINUTES_PUBLISH })
  const minutes = await prisma.meetingMinutes.findFirst({ where: { id: minutesId, meetingId } })
  if (!minutes) throw new Error("Minutes not found")
  if (minutes.status === "PUBLISHED") return minutes

  const published = await prisma.meetingMinutes.update({
    where: { id: minutesId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  })

  await prisma.meetingMinutesVersion.updateMany({
    where: { minutesId, version: { equals: 1 } },
    data: { publishedAt: new Date() },
  })

  createAuditLog({ userId, circleId, action: "MEETING_MINUTES_PUBLISHED", entityType: "MeetingMinutes", entityId: minutesId }).catch(() => {})
  notifyCircleMembers(circleId, userId, {
    type: "MINUTES_PUBLISHED",
    title: "Meeting minutes published",
    message: `Minutes for ${meetingId} are now available`,
    link: `/circles/${circleId}/meetings/${meetingId}`,
  }).catch(() => {})
  return published
}

export async function amendMinutes(circleId: string, meetingId: string, minutesId: string, userId: string, content: Record<string, unknown>, changeNote?: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_MINUTES_MANAGE })
  const minutes = await prisma.meetingMinutes.findFirst({ where: { id: minutesId, meetingId } })
  if (!minutes) throw new Error("Minutes not found")
  if (minutes.status !== "PUBLISHED" && minutes.status !== "AMENDED") throw new Error("Only published minutes are amended")

  const json = { content, amendedAt: new Date().toISOString(), amendedById: userId, previousVersionId: minutes.id } as unknown as Prisma.InputJsonValue
  const nextVersion = (await prisma.meetingMinutesVersion.count({ where: { minutesId } })) + 1

  await prisma.meetingMinutesVersion.create({
    data: { minutesId, version: nextVersion, content: json, editedById: userId, changeNote: changeNote || null },
  })

  const updated = await prisma.meetingMinutes.update({ where: { id: minutesId }, data: { status: "AMENDED", content: json } })
  createAuditLog({ userId, circleId, action: "MEETING_MINUTES_AMENDED", entityType: "MeetingMinutes", entityId: minutesId, reason: changeNote || null, newValues: { version: nextVersion } }).catch(() => {})
  notifyCircleMembers(circleId, userId, {
    type: "MINUTES_AMENDED",
    title: "Meeting minutes amended",
    message: "Published minutes were updated with an audited amendment",
    link: `/circles/${circleId}/meetings/${meetingId}`,
  }).catch(() => {})
  return updated
}

export async function getMinutes(circleId: string, meetingId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_VIEW })
  return prisma.meetingMinutes.findFirst({
    where: { meetingId },
    include: { versions: { orderBy: { version: "asc" }, include: { editedBy: { select: { id: true, name: true } } } }, createdBy: { select: { id: true, name: true } } },
  })
}

/**
 * Records a member's acknowledgement of published minutes. Requires a member of
 * the circle; the minutes must be PUBLISHED. Duplicate acknowledgements are
 * prevented by the (minutesId, userId) unique constraint.
 */
export async function acknowledgeMinutes(circleId: string, meetingId: string, minutesId: string, userId: string) {
  await validateMember(circleId, userId)
  const minutes = await prisma.meetingMinutes.findFirst({ where: { id: minutesId, meetingId } })
  if (!minutes) throw new Error("Minutes not found")
  if (minutes.status !== "PUBLISHED") throw new Error("Only published minutes can be acknowledged")

  const ack = await prisma.meetingMinutesAcknowledgement.upsert({
    where: { minutesId_userId: { minutesId, userId } },
    create: { minutesId, userId },
    update: {},
  })
  createAuditLog({ userId, circleId, action: "MINUTES_ACKNOWLEDGED", entityType: "MeetingMinutes", entityId: minutesId, affectedUserId: userId }).catch(() => {})
  return ack
}

/** Members who acknowledged a meeting's published minutes. */
export async function getMinutesAcknowledgements(circleId: string, meetingId: string, minutesId: string, userId: string) {
  await requireCirclePermission({ userId, circleId, permission: CIRCLE_PERMISSIONS.MEETING_VIEW })
  return prisma.meetingMinutesAcknowledgement.findMany({
    where: { minutesId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })
}

/**
 * Scheduling primitive for MEETING_REMINDER notifications. De-duplicated per
 * (meetingId, userId) via the RSVP notifiedReminder flag so a member is reminded
 * at most once per meeting. Returns the number of reminders sent.
 */
export async function sendMeetingReminders(circleId: string, meetingId: string, leadHours = 24): Promise<number> {
  const meeting = await getMeetingOrThrow(circleId, meetingId)
  const now = Date.now()
  const leadMs = leadHours * 3600000
  if (!meeting.scheduledAt || meeting.status === "CANCELLED" || meeting.status === "COMPLETED") return 0
  const delta = new Date(meeting.scheduledAt).getTime() - now
  if (delta > leadMs || delta < 0) return 0

  const rsvps = await prisma.meetingRSVP.findMany({ where: { meetingId, status: { in: ["GOING", "MAYBE"] }, notifiedReminder: false } })
  let sent = 0
  for (const rsvp of rsvps) {
    await createNotification({
      userId: rsvp.userId,
      circleId,
      type: "MEETING_REMINDER",
      title: `Reminder: ${meeting.title}`,
      message: `Starts ${new Date(meeting.scheduledAt).toLocaleString()}`,
      link: `/circles/${circleId}/meetings/${meetingId}`,
    }).catch(() => {})
    await prisma.meetingRSVP.update({ where: { id: rsvp.id }, data: { notifiedReminder: true } }).catch(() => {})
    sent++
  }
  return sent
}
