/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"
import { addProjectActivity } from "@/lib/services/project.service"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function getProjectInvestorUserIds(projectId: string): Promise<string[]> {
  const rows = await prisma.projectContribution.findMany({
    where: { projectId, status: "CONFIRMED" },
    distinct: ["userId"],
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}

export async function isProjectInvestor(projectId: string, userId: string): Promise<boolean> {
  const c = await prisma.projectContribution.findFirst({ where: { projectId, userId, status: "CONFIRMED" }, select: { id: true } })
  return !!c
}

async function notifyInvestorsOnly(circleId: string, projectId: string, type: any, title: string, message: string, link?: string, excludeUserId?: string) {
  let ids = await getProjectInvestorUserIds(projectId)
  if (excludeUserId) ids = ids.filter((id) => id !== excludeUserId)
  if (ids.length === 0) return
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  await createBulkNotifications(ids.map((userId) => ({ userId, circleId, type, title, message, link: link || null }))).catch(() => {})
}

async function notifyProjectMembers(circleId: string, type: any, title: string, message: string, link?: string) {
  const { notifyCircleMembers } = await import("@/lib/services/notification.service")
  await notifyCircleMembers(circleId, null, { type, title, message, link: link || null }).catch(() => {})
}

interface ViewerCtx {
  viewerUserId: string
  isInvestor: boolean
  isManager: boolean
}

function canSeeUpdate(viewer: ViewerCtx, visibility: string): boolean {
  if (visibility === "ALL_MEMBERS") return true
  if (visibility === "INVESTORS_ONLY") return viewer.isInvestor || viewer.isManager
  return viewer.isManager
}

// ─── Project Updates ─────────────────────────────────────────

export async function listProjectUpdates(projectId: string, circleId: string, viewer: ViewerCtx) {
  const updates = await prisma.projectUpdate.findMany({
    where: { projectId, circleId },
    include: {
      createdBy: { select: { name: true } },
      attachments: true,
      acknowledgments: true,
      discussions: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
  })
  const visible = updates.filter((u) => canSeeUpdate(viewer, u.visibility))
  return visible.map((u) => ({
    id: u.id,
    type: u.type,
    title: u.title,
    content: u.content,
    visibility: u.visibility,
    isImportant: u.isImportant,
    publishedAt: u.publishedAt.toISOString(),
    createdByName: u.createdBy?.name ?? null,
    attachments: u.attachments.map((a) => ({ id: a.id, name: a.name, url: a.url, mimeType: a.mimeType, size: a.size ?? 0 })),
    acknowledged: viewer.isManager ? u.acknowledgments.length : 0,
    myAcknowledged: u.acknowledgments.some((a) => a.userId === viewer.viewerUserId),
    discussions: u.discussions.map((d) => ({ id: d.id, kind: d.kind, content: d.content, reaction: d.reaction, userId: d.userId, userName: d.user?.name ?? null, createdAt: d.createdAt.toISOString() })),
  }))
}

export async function getProjectUpdate(updateId: string, projectId: string, viewer: ViewerCtx) {
  const u = await prisma.projectUpdate.findUnique({
    where: { id: updateId },
    include: { createdBy: { select: { name: true } }, attachments: true, acknowledgments: true, discussions: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } } },
  })
  if (!u || u.projectId !== projectId) throw new Error("Not found")
  if (!canSeeUpdate(viewer, u.visibility)) throw new Error("Not found")
  return {
    id: u.id,
    type: u.type,
    title: u.title,
    content: u.content,
    visibility: u.visibility,
    isImportant: u.isImportant,
    publishedAt: u.publishedAt.toISOString(),
    createdByName: u.createdBy?.name ?? null,
    attachments: u.attachments.map((a) => ({ id: a.id, name: a.name, url: a.url, mimeType: a.mimeType, size: a.size ?? 0 })),
    ackCount: u.acknowledgments.length,
    myAcknowledged: u.acknowledgments.some((a) => a.userId === viewer.viewerUserId),
    discussions: u.discussions.map((d) => ({ id: d.id, kind: d.kind, content: d.content, reaction: d.reaction, userId: d.userId, userName: d.user?.name ?? null, createdAt: d.createdAt.toISOString() })),
  }
}

const UPDATE_NOTIFICATION_TYPE: Record<string, any> = {
  FINANCIAL: "INVESTOR_FINANCIAL_REPORT",
  RISK: "MATERIAL_RISK",
}

export async function createProjectUpdate(projectId: string, circleId: string, userId: string, data: {
  type: string
  title: string
  content?: string
  visibility?: string
  isImportant?: boolean
}) {
  const title = (data.title || "").trim()
  if (!title) throw new Error("Title is required")
  const update = await prisma.projectUpdate.create({
    data: {
      projectId, circleId, createdById: userId,
      type: (data.type || "GENERAL") as any,
      title,
      content: data.content ?? null,
      visibility: (data.visibility || "INVESTORS_ONLY") as any,
      isImportant: data.isImportant ?? false,
    },
  })
  await addProjectActivity(projectId, userId, "update_published", `Update: ${title}`, data.content || undefined)
  await createAuditLog({ userId, circleId, action: "INVESTOR_UPDATE_PUBLISHED", entityType: "ProjectUpdate", entityId: update.id, newValues: { type: update.type, title } })
  const notifType = UPDATE_NOTIFICATION_TYPE[update.type] || "INVESTOR_UPDATE_PUBLISHED"
  const link = `/circles/${circleId}/projects/${projectId}/investors?updates=${update.id}`
  if (update.visibility === "INVESTORS_ONLY") {
    await notifyInvestorsOnly(circleId, projectId, notifType, `${title}`, data.content || "A new project update was published.", link)
  } else {
    await notifyProjectMembers(circleId, notifType, title, data.content || "A new project update was published.", link)
  }
  return update
}

export async function updateProjectUpdate(projectId: string, updateId: string, userId: string, data: Record<string, unknown>) {
  const u = await prisma.projectUpdate.findFirst({ where: { id: updateId, projectId } })
  if (!u) throw new Error("Not found")
  const allowed = ["title", "content", "visibility", "type", "isImportant"]
  const safe: Record<string, unknown> = {}
  for (const k of allowed) if (data[k] !== undefined) safe[k] = data[k]
  const updated = await prisma.projectUpdate.update({ where: { id: updateId }, data: safe as any })
  await createAuditLog({ userId, circleId: u.circleId, action: "INVESTOR_UPDATE_EDITED", entityType: "ProjectUpdate", entityId: updateId, newValues: safe })
  return updated
}

export async function deleteProjectUpdate(projectId: string, updateId: string, userId: string) {
  const u = await prisma.projectUpdate.findFirst({ where: { id: updateId, projectId } })
  if (!u) throw new Error("Not found")
  await prisma.projectUpdate.delete({ where: { id: updateId } })
  await createAuditLog({ userId, circleId: u.circleId, action: "INVESTOR_UPDATE_DELETED", entityType: "ProjectUpdate", entityId: updateId })
  return { ok: true }
}

export async function acknowledgeProjectUpdate(updateId: string, userId: string) {
  const u = await prisma.projectUpdate.findUnique({ where: { id: updateId } })
  if (!u) throw new Error("Not found")
  const existing = await prisma.projectUpdateAcknowledgment.findFirst({ where: { updateId, userId } })
  if (!existing) {
    await prisma.projectUpdateAcknowledgment.create({ data: { updateId, userId } })
  } else {
    await prisma.projectUpdateAcknowledgment.delete({ where: { id: existing.id } })
  }
  return { ok: true }
}

export async function addUpdateAttachment(projectId: string, updateId: string, userId: string, data: { name: string; url: string; mimeType?: string; size?: number }) {
  const u = await prisma.projectUpdate.findFirst({ where: { id: updateId, projectId } })
  if (!u) throw new Error("Not found")
  const att = await prisma.projectUpdateAttachment.create({ data: { updateId, uploadedById: userId, name: data.name, url: data.url, mimeType: data.mimeType ?? null, size: data.size ?? null } })
  await createAuditLog({ userId, circleId: u.circleId, action: "INVESTOR_UPDATE_ATTACHMENT", entityType: "ProjectUpdateAttachment", entityId: att.id })
  return att
}

export async function addUpdateDiscussion(projectId: string, updateId: string, userId: string, data: { kind: string; content?: string; reaction?: string }) {
  const u = await prisma.projectUpdate.findFirst({ where: { id: updateId, projectId } })
  if (!u) throw new Error("Not found")
  return prisma.projectUpdateDiscussion.create({ data: { updateId, userId, kind: (data.kind || "COMMENT") as any, content: data.content ?? null, reaction: data.reaction ?? null } })
}

export async function deleteUpdateDiscussion(projectId: string, updateId: string, discussionId: string, userId: string, isManager: boolean) {
  const d = await prisma.projectUpdateDiscussion.findFirst({ where: { id: discussionId, updateId, update: { projectId } } })
  if (!d) throw new Error("Not found")
  if (!isManager && d.userId !== userId) throw new Error("You can only delete your own message")
  await prisma.projectUpdateDiscussion.delete({ where: { id: discussionId } })
  return { ok: true }
}

// ─── Milestones ──────────────────────────────────────────────

export async function listMilestones(projectId: string) {
  const ms = await prisma.projectMilestone.findMany({ where: { projectId }, include: { createdBy: { select: { name: true } } }, orderBy: { targetDate: "asc" } })
  return ms.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    targetDate: m.targetDate ? m.targetDate.toISOString() : null,
    status: m.status,
    progress: m.progress,
    budget: m.budget != null ? asNum(m.budget) : null,
    actualCost: asNum(m.actualCost),
    createdAt: m.createdAt.toISOString(),
  }))
}

export async function createMilestone(projectId: string, circleId: string, userId: string, data: {
  title: string
  description?: string
  targetDate?: string | null
  budget?: number
  progress?: number
}) {
  if (!(data.title || "").trim()) throw new Error("Title is required")
  const m = await prisma.projectMilestone.create({
    data: {
      projectId, circleId, createdById: userId,
      title: data.title.trim(),
      description: data.description ?? null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      budget: data.budget ?? null,
      progress: Math.max(0, Math.min(100, data.progress ?? 0)),
    },
  })
  await addProjectActivity(projectId, userId, "milestone_created", `Milestone: ${m.title}`)
  await createAuditLog({ userId, circleId, action: "INVESTOR_MILESTONE_CREATED", entityType: "ProjectMilestone", entityId: m.id, newValues: { title: m.title } })
  return m
}

export async function updateMilestone(projectId: string, milestoneId: string, circleId: string, userId: string, data: Record<string, unknown>) {
  const m = await prisma.projectMilestone.findFirst({ where: { id: milestoneId, projectId } })
  if (!m) throw new Error("Not found")
  const safe: Record<string, unknown> = {}
  for (const k of ["title", "description", "targetDate", "budget"]) if (data[k] !== undefined) safe[k] = data[k]
  if (safe.targetDate === "") safe.targetDate = null
  if (typeof safe.targetDate === "string") safe.targetDate = new Date(safe.targetDate)
  if ("progress" in data) safe.progress = Math.max(0, Math.min(100, Number(data.progress) || 0))
  const updated = await prisma.projectMilestone.update({ where: { id: milestoneId }, data: safe as any })
  await createAuditLog({ userId, circleId, action: "INVESTOR_MILESTONE_UPDATED", entityType: "ProjectMilestone", entityId: milestoneId, newValues: safe })
  return updated
}

export async function transitionMilestone(projectId: string, milestoneId: string, circleId: string, userId: string, nextStatus: string) {
  const m = await prisma.projectMilestone.findFirst({ where: { id: milestoneId, projectId } })
  if (!m) throw new Error("Not found")
  if (nextStatus === "COMPLETED" && m.progress < 100) {
    await prisma.projectMilestone.update({ where: { id: milestoneId }, data: { progress: 100 } })
  }
  const updated = await prisma.projectMilestone.update({
    where: { id: milestoneId },
    data: { status: nextStatus as any, completedAt: nextStatus === "COMPLETED" ? new Date() : null },
  })
  await addProjectActivity(projectId, userId, `milestone_${nextStatus.toLowerCase()}`, `Milestone "${m.title}" ${nextStatus.toLowerCase()}`)
  await createAuditLog({ userId, circleId, action: "INVESTOR_MILESTONE_TRANSITION", entityType: "ProjectMilestone", entityId: milestoneId, newValues: { status: nextStatus } })
  if (nextStatus === "COMPLETED") {
    await notifyInvestorsOnly(circleId, projectId, "MILESTONE_REACHED", `Milestone reached: ${m.title}`, "A project milestone was completed.", `/circles/${circleId}/projects/${projectId}/investors?milestones`)
  } else if (nextStatus === "DELAYED" || nextStatus === "AT_RISK") {
    await notifyInvestorsOnly(circleId, projectId, "MILESTONE_DELAYED", `Milestone ${nextStatus.toLowerCase()}: ${m.title}`, "A milestone is delayed or at risk.", `/circles/${circleId}/projects/${projectId}/investors?milestones`)
  }
  return updated
}

// ─── Investor Q&A ────────────────────────────────────────────

export async function listInvestorQuestions(projectId: string, circleId: string, viewer: ViewerCtx) {
  const qs = await prisma.investorQuestion.findMany({
    where: { projectId },
    include: { user: { select: { name: true } }, answeredBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return qs
    .filter((q) => q.visibility === "PUBLIC" || viewer.isInvestor || viewer.isManager)
    .map((q) => ({
      id: q.id,
      question: q.question,
      visibility: q.visibility,
      status: q.status,
      answered: q.answer,
      answerer: q.answeredBy?.name ?? null,
      answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
      published: q.publishedToInvestors,
      askerName: q.user?.name ?? null,
      isMine: q.userId === viewer.viewerUserId,
      createdAt: q.createdAt.toISOString(),
    }))
}

export async function createInvestorQuestion(projectId: string, circleId: string, userId: string, data: { question: string; visibility?: string }) {
  if (!(data.question || "").trim()) throw new Error("Question is required")
  if (!(await isProjectInvestor(projectId, userId))) throw new Error("Only invested members can submit questions")
  const q = await prisma.investorQuestion.create({
    data: { projectId, circleId, userId, question: data.question.trim(), visibility: (data.visibility || "INVESTORS_ONLY") as any },
  })
  await createAuditLog({ userId, circleId, action: "INVESTOR_QUESTION_ASKED", entityType: "InvestorQuestion", entityId: q.id })
  return q
}

export async function answerInvestorQuestion(projectId: string, questionId: string, circleId: string, adminId: string, data: { answer: string; publishToInvestors?: boolean }) {
  const q = await prisma.investorQuestion.findFirst({ where: { id: questionId, projectId } })
  if (!q) throw new Error("Not found")
  if (!(data.answer || "").trim()) throw new Error("Answer is required")
  const updated = await prisma.investorQuestion.update({
    where: { id: questionId },
    data: { status: "ANSWERED", answer: data.answer.trim(), answeredById: adminId, answeredAt: new Date(), publishedToInvestors: data.publishToInvestors ?? q.publishedToInvestors },
  })
  await createAuditLog({ userId: adminId, circleId, action: "INVESTOR_QUESTION_ANSWERED", entityType: "InvestorQuestion", entityId: questionId })
  const { createNotification } = await import("@/lib/services/notification.service")
  await createNotification({ userId: q.userId, circleId, type: "INVESTOR_QUESTION_ANSWERED", title: "Your question was answered", message: data.answer.trim(), link: `/circles/${circleId}/projects/${projectId}/investors?questions` }).catch(() => {})
  if (data.publishToInvestors) {
    await notifyInvestorsOnly(circleId, projectId, "INVESTOR_QUESTION_ANSWERED", "A question was answered", q.question, `/circles/${circleId}/projects/${projectId}/investors?questions`, q.userId)
  }
  return updated
}

export async function resolveInvestorQuestion(projectId: string, questionId: string, circleId: string, adminId: string) {
  const q = await prisma.investorQuestion.findFirst({ where: { id: questionId, projectId } })
  if (!q) throw new Error("Not found")
  const updated = await prisma.investorQuestion.update({ where: { id: questionId }, data: { status: "RESOLVED", resolvedById: adminId, resolvedAt: new Date() } })
  await createAuditLog({ userId: adminId, circleId, action: "INVESTOR_QUESTION_RESOLVED", entityType: "InvestorQuestion", entityId: questionId })
  return updated
}

export async function editOwnInvestorQuestion(projectId: string, questionId: string, userId: string, data: { question: string }) {
  const q = await prisma.investorQuestion.findFirst({ where: { id: questionId, projectId } })
  if (!q) throw new Error("Not found")
  if (q.userId !== userId) throw new Error("You can only edit your own question")
  if (q.status !== "OPEN") throw new Error("Only open questions can be edited")
  if (!(data.question || "").trim()) throw new Error("Question is required")
  return prisma.investorQuestion.update({ where: { id: questionId }, data: { question: data.question.trim() } })
}

// ─── Investor Documents ──────────────────────────────────────

export async function listInvestorDocuments(projectId: string, circleId: string, viewer: ViewerCtx) {
  const docs = await prisma.investorProjectDocument.findMany({
    where: { projectId, circleId },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return docs
    .filter((d) => d.visibility === "ALL_MEMBERS" || viewer.isInvestor || viewer.isManager)
    .map((d) => ({
      id: d.id,
      category: d.category,
      name: d.name,
      description: d.description,
      url: d.url,
      mimeType: d.mimeType,
      size: d.size ?? 0,
      visibility: d.visibility,
      milestoneId: d.milestoneId,
      uploadedByName: d.uploadedBy?.name ?? null,
      createdAt: d.createdAt.toISOString(),
    }))
}

export async function addInvestorDocument(circleId: string, projectId: string, userId: string, data: {
  name: string
  url: string
  category?: string
  visibility?: string
  description?: string
  mimeType?: string
  size?: number
  milestoneId?: string | null
}) {
  const doc = await prisma.investorProjectDocument.create({
    data: {
      projectId, circleId, uploadedById: userId,
      name: data.name,
      description: data.description ?? null,
      url: data.url,
      category: (data.category || "OTHER") as any,
      visibility: (data.visibility || "INVESTORS_ONLY") as any,
      mimeType: data.mimeType ?? null,
      size: data.size ?? null,
      milestoneId: data.milestoneId ?? null,
    },
  })
  await addProjectActivity(projectId, userId, "document_published", `Document: ${data.name}`)
  await createAuditLog({ userId, circleId, action: "INVESTOR_DOCUMENT_PUBLISHED", entityType: "InvestorProjectDocument", entityId: doc.id, newValues: { name: data.name } })
  const link = `/circles/${circleId}/projects/${projectId}/investors?documents`
  if (doc.visibility === "INVESTORS_ONLY") {
    await notifyInvestorsOnly(circleId, projectId, "INVESTOR_DOCUMENT_PUBLISHED", `Document published: ${data.name}`, data.description || "A new investor document is available.", link)
  } else {
    await notifyProjectMembers(circleId, "INVESTOR_DOCUMENT_PUBLISHED", data.name, "A new project document is available.", link)
  }
  return doc
}

// ─── Investor Meetings ───────────────────────────────────────

export async function listProjectMeetings(projectId: string, circleId: string) {
  const meets = await prisma.meeting.findMany({ where: { projectId, circleId, deletedAt: null }, orderBy: { scheduledAt: "asc" } })
  return meets.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    scheduledAt: m.scheduledAt.toISOString(),
    status: m.status,
    isOnline: m.isOnline,
    meetingLink: m.meetingLink,
  }))
}

export async function scheduleInvestorMeeting(circleId: string, projectId: string, userId: string, data: {
  title: string
  scheduledAt: string
  description?: string
  isOnline?: boolean
  meetingLink?: string
}) {
  if (!(data.title || "").trim()) throw new Error("Title is required")
  if (!data.scheduledAt) throw new Error("Meeting time is required")
  const { createMeeting } = await import("@/lib/services/meeting.service")
  const meeting = await createMeeting(circleId, userId, {
    title: data.title.trim(),
    description: data.description,
    scheduledAt: new Date(data.scheduledAt),
    isOnline: data.isOnline ?? false,
    meetingLink: data.meetingLink,
    status: "SCHEDULED",
    type: "GENERAL",
  } as any)
  await prisma.meeting.update({ where: { id: meeting.id }, data: { projectId } })
  await addProjectActivity(projectId, userId, "meeting_scheduled", `Investor meeting: ${meeting.title}`)
  await notifyInvestorsOnly(circleId, projectId, "INVESTOR_MEETING", `Investor meeting: ${meeting.title}`, `${meeting.description || "An investor meeting was scheduled."}`, `/circles/${circleId}/projects/${projectId}/investors?meetings`)
  return meeting
}

// ─── Investor Dashboard (compact, for Project Overview) ──────

export async function getInvestorDashboard(projectId: string, circleId: string, viewer: ViewerCtx) {
  const [updates, milestones, documents, questions, meetings, distributions] = await Promise.all([
    prisma.projectUpdate.findMany({ where: { projectId, circleId }, include: { acknowledgments: true, attachments: true }, orderBy: { publishedAt: "desc" }, take: 20 }),
    prisma.projectMilestone.findMany({ where: { projectId }, orderBy: { targetDate: "asc" } }),
    prisma.investorProjectDocument.findMany({ where: { projectId, circleId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.investorQuestion.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.meeting.findMany({ where: { projectId, circleId, deletedAt: null }, orderBy: { scheduledAt: "asc" } }),
    prisma.projectDistribution.findMany({ where: { projectId, status: { notIn: ["PAID", "CANCELLED"] } }, orderBy: { createdAt: "desc" } }),
  ])

  const visibleUpdates = updates.filter((u) => canSeeUpdate(viewer, u.visibility))
  const visibleDocs = documents.filter((d) => d.visibility === "ALL_MEMBERS" || viewer.isInvestor || viewer.isManager)
  const visibleQuestions = questions.filter((q) => q.visibility === "PUBLIC" || viewer.isInvestor || viewer.isManager)

  const nextDistribution = distributions[0]
    ? { id: distributions[0].id, name: distributions[0].name, amount: asNum(distributions[0].totalProfit), date: new Date(distributions[0].distributionDate || distributions[0].createdAt).toISOString(), status: distributions[0].status }
    : null

  return {
    latestUpdate: visibleUpdates[0]
      ? { id: visibleUpdates[0].id, type: visibleUpdates[0].type, title: visibleUpdates[0].title, publishedAt: visibleUpdates[0].publishedAt.toISOString(), isImportant: visibleUpdates[0].isImportant, acknowledged: viewer.isManager ? visibleUpdates[0].acknowledgments.length : 0, myAcknowledged: visibleUpdates[0].acknowledgments.some((a) => a.userId === viewer.viewerUserId) }
      : null,
    updateCount: visibleUpdates.length,
    unreadByMe: visibleUpdates.filter((u) => !u.acknowledgments.some((a) => a.userId === viewer.viewerUserId)).filter((u) => u.isImportant).length,
    milestones: milestones
      .filter((m) => m.status !== "CANCELLED")
      .map((m) => ({ id: m.id, title: m.title, targetDate: m.targetDate ? m.targetDate.toISOString() : null, status: m.status, progress: m.progress, budget: m.budget != null ? asNum(m.budget) : null, actualCost: asNum(m.actualCost) })),
    completedMilestones: milestones.filter((m) => m.status === "COMPLETED").length,
    unresolvedRisks: [
      ...visibleUpdates.filter((u) => u.type === "RISK").slice(0, 3).map((u) => ({ id: `u-${u.id}`, kind: "update", title: u.title, date: u.publishedAt.toISOString() })),
      ...milestones.filter((m) => m.status === "DELAYED" || m.status === "AT_RISK").map((m) => ({ id: `m-${m.id}`, kind: "milestone", title: m.title, date: m.targetDate ? m.targetDate.toISOString() : m.updatedAt.toISOString() })),
    ].slice(0, 5),
    questionCount: visibleQuestions.filter((q) => q.status !== "RESOLVED").length,
    unansweredQuestions: visibleQuestions.filter((q) => q.status === "OPEN").length,
    latestDocuments: visibleDocs.slice(0, 5).map((d) => ({ id: d.id, category: d.category, name: d.name, url: d.url, createdAt: d.createdAt.toISOString() })),
    upcomingMeetings: meetings.filter((m) => m.status === "SCHEDULED" || m.status === "DRAFT").slice(0, 3).map((m) => ({ id: m.id, title: m.title, scheduledAt: m.scheduledAt.toISOString(), isOnline: m.isOnline })),
    nextDistribution,
    isInvestor: viewer.isInvestor,
    isManager: viewer.isManager,
  }
}