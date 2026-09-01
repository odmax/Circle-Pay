/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

export const CHORE_CATEGORIES = ["CLEANING", "DISHES", "TRASH", "BATHROOM", "KITCHEN", "LAUNDRY", "SHOPPING", "GARDEN", "PET_CARE", "CUSTOM"]
export const CHORE_FREQUENCIES = ["ONCE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]

export function occurrenceKey(freq: string, date: Date): string {
  if (freq === "ONCE") return "once"
  if (freq === "DAILY") return date.toISOString().slice(0, 10)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = d.getTime()
  d.setUTCMonth(0, 1)
  if (d.getUTCDay() !== 4) d.setUTCMonth(0, 1 + ((4 - d.getUTCDay()) + 7) % 7)
  const week = 1 + Math.round((firstThursday - d.getTime()) / (7 * 86400000))
  if (freq === "WEEKLY") return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
  if (freq === "BIWEEKLY") return `${date.getUTCFullYear()}-BW${String(Math.floor((week - 1) / 2)).padStart(2, "0")}`
  if (freq === "MONTHLY") return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
  return date.toISOString().slice(0, 10)
}

export function periodStartDate(freq: string, date: Date): Date {
  if (freq === "DAILY") return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (freq === "WEEKLY") { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d }
  if (freq === "BIWEEKLY") { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); if (Math.floor(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000)) / 2) % 2 === 0) d.setDate(d.getDate() - 7); return d }
  if (freq === "MONTHLY") return new Date(date.getFullYear(), date.getMonth(), 1)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function dueAt(date: Date, dueTime: string | null): Date {
  if (!dueTime) return date
  const [h, m] = dueTime.split(":").map(Number)
  const d = new Date(date)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

export function computeChoreStatus(due: Date, status: string, now = new Date()): string {
  if (status === "COMPLETED" || status === "SKIPPED") return status
  if (due.getTime() < now.getTime() - 86400000) return "OVERDUE"
  if (due.getTime() <= now.getTime()) return "DUE"
  return "UPCOMING"
}

export function pickRotationAssignee(cursor: number, members: string[]): string | null {
  if (!members.length) return null
  return members[cursor % members.length]
}

// Idempotent recurrence generation.
export async function ensureChoreGeneration(circleId: string) {
  const templates = await prisma.householdChoreTemplate.findMany({ where: { circleId, active: true, archived: false } })
  const created: string[] = []
  const now = new Date()
  for (const t of templates) {
    const ocKey = occurrenceKey(t.frequency, now)
    if (await prisma.householdChore.findUnique({ where: { templateId_ocKey: { templateId: t.id, ocKey } } })) continue

    const rotationMembers: string[] = (t.rotationMembers as any) || []
    const fixedIds: string[] = (t.assigneeIds as any) || []
    let assigneeId: string | null = null
    if (t.rotationType === "ROUND_ROBIN" && rotationMembers.length) {
      const cursor = ((t.metadata as any)?.rotationCursor as number) || 0
      assigneeId = pickRotationAssignee(cursor, rotationMembers)
      await prisma.householdChoreTemplate.update({ where: { id: t.id }, data: { metadata: { ...((t.metadata as any) || {}), rotationCursor: cursor + 1 } } })
    } else if (fixedIds.length) {
      assigneeId = fixedIds[0]
    }

    const due = dueAt(periodStartDate(t.frequency, now), t.dueTime)
    if (assigneeId) {
      await prisma.householdChore.create({
        data: {
          templateId: t.id, circleId, ocKey, title: t.title, description: t.description, category: t.category,
          assigneeId, dueDate: due, dueTime: t.dueTime, frequency: t.frequency, priority: t.priority, points: t.points,
          status: computeChoreStatus(due, "UPCOMING", now),
        },
      })
      created.push(`${t.id}:${ocKey}`)
      await notifyOne(circleId, assigneeId, "CHORE_ASSIGNED", `Chore assigned: ${t.title}`, t.frequency === "ONCE" ? "One-off responsibility." : `Recurring ${t.frequency.toLowerCase()} responsibility.`)
    }
  }
  return created
}

async function notifyOne(circleId: string, userId: string, type: any, title: string, message: string) {
  const { createNotification } = await import("@/lib/services/notification.service")
  await createNotification({ userId, circleId, type, title, message, link: `/circles/${circleId}/chores` }).catch(() => {})
}

async function notifyMany(circleId: string, userIds: string[], type: any, title: string, message: string) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return
  const { createBulkNotifications } = await import("@/lib/services/notification.service")
  await createBulkNotifications(ids.map((userId) => ({ userId, circleId, type, title, message, link: `/circles/${circleId}/chores` }))).catch(() => {})
}

// ─── Reads ──────────────────────────────────────────────────

export async function listChores(circleId: string, viewerId: string) {
  await ensureChoreGeneration(circleId)
  const chores = await prisma.householdChore.findMany({ where: { circleId }, include: { assignee: { select: { name: true } }, completedBy: { select: { name: true } }, swaps: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { dueDate: "asc" } })
  const templates = await prisma.householdChoreTemplate.findMany({ where: { circleId }, orderBy: { createdAt: "desc" } })
  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)

  const view = chores.map((c) => ({
    id: c.id, title: c.title, description: c.description, category: c.category, assigneeId: c.assigneeId, assigneeName: c.assignee?.name ?? null,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null, dueTime: c.dueTime, status: c.status, points: c.points,
    completedByName: c.completedBy?.name ?? null, completionNote: c.completionNote, proofUrl: c.proofUrl,
    swappedFromId: c.swappedFromId, isMine: c.assigneeId === viewerId,
  }))

  const mine = view.filter((c) => c.isMine)
  const today = view.filter((c) => c.dueDate && c.dueDate.slice(0, 10) === todayKey && c.status !== "COMPLETED" && c.status !== "SKIPPED")
  const overdue = view.filter((c) => c.status === "OVERDUE")
  const thisWeek = view.filter((c) => c.dueDate && new Date(c.dueDate) >= weekAgo && c.status === "COMPLETED")
  const completedThisWeek = thisWeek.length
  const nextResponsibility = view.filter((c) => c.status !== "COMPLETED" && c.status !== "SKIPPED" && c.dueDate).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0] ?? null
  const total = view.length
  const completionPct = total > 0 ? Math.round((view.filter((c) => c.status === "COMPLETED").length / total) * 100) : 0

  const byMember = new Map<string, { assigned: number; completed: number; overdue: number }>()
  for (const c of view) {
    if (!c.assigneeId) continue
    const m = byMember.get(c.assigneeId) || { assigned: 0, completed: 0, overdue: 0 }
    if (c.status !== "COMPLETED" && c.status !== "SKIPPED") m.assigned++
    if (c.status === "COMPLETED") m.completed++
    if (c.status === "OVERDUE") m.overdue++
    byMember.set(c.assigneeId, m)
  }
  const memberIds = Array.from(byMember.keys())
  const members = memberIds.length ? await prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true } }) : []
  const nameOf = new Map(members.map((u) => [u.id, u.name]))
  const fairness = Array.from(byMember.entries()).map(([userId, s]) => ({ userId, name: nameOf.get(userId) ?? userId, ...s, pct: s.assigned + s.completed > 0 ? Math.round((s.completed / (s.assigned + s.completed)) * 100) : 0 }))
  const assignedCounts = fairness.map((f) => f.assigned).filter((n) => n > 0)
  const uneven = assignedCounts.length > 1 ? Math.max(...assignedCounts) - Math.min(...assignedCounts) >= 2 : false

  return { chores: view, templates, fairness, uneven, mine, today, overdue, completedThisWeek, nextResponsibility, completionPct }
}

// ─── Template CRUD (manager) ───────────────────────────────

export async function createChoreTemplate(circleId: string, userId: string, data: any) {
  const title = (data.title || "").trim()
  if (!title) throw new Error("Chore title is required")
  const t = await prisma.householdChoreTemplate.create({
    data: {
      circleId, createdById: userId, title,
      description: data.description ?? null, category: (data.category || "CLEANING") as any,
      frequency: (data.frequency || "WEEKLY") as any, dueTime: data.dueTime ?? null,
      priority: Number(data.priority) || 0, points: Number(data.points) || 0,
      assigneeIds: Array.isArray(data.assigneeIds) ? data.assigneeIds : null,
      rotationType: (data.rotationType || "FIXED") as any,
      rotationMembers: Array.isArray(data.rotationMembers) ? data.rotationMembers : null,
      active: data.active ?? true,
    },
  })
  await createAuditLog({ userId, circleId, action: "CHORE_TEMPLATE_CREATED", entityType: "HouseholdChoreTemplate", entityId: t.id, newValues: { title } })
  await ensureChoreGeneration(circleId)
  return t
}

export async function updateChoreTemplate(circleId: string, templateId: string, userId: string, data: any) {
  const t = await prisma.householdChoreTemplate.findFirst({ where: { id: templateId, circleId } })
  if (!t) throw new Error("Not found")
  const safe: any = {}
  for (const k of ["title", "description", "category", "frequency", "dueTime", "priority", "points", "assigneeIds", "rotationType", "rotationMembers", "active", "archived"]) if (data[k] !== undefined) safe[k] = data[k]
  const updated = await prisma.householdChoreTemplate.update({ where: { id: templateId }, data: safe })
  await createAuditLog({ userId, circleId, action: "CHORE_TEMPLATE_UPDATED", entityType: "HouseholdChoreTemplate", entityId: templateId, newValues: safe })
  await ensureChoreGeneration(circleId)
  return updated
}

// ─── Instance actions ──────────────────────────────────────

export async function completeChore(circleId: string, choreId: string, actorId: string, isManager: boolean, data: { note?: string; proofUrl?: string }) {
  const c = await prisma.householdChore.findFirst({ where: { id: choreId, circleId } })
  if (!c) throw new Error("Not found")
  if (!isManager && c.assigneeId !== actorId) throw new Error("You can only complete chores assigned to you")
  const updated = await prisma.householdChore.update({
    where: { id: choreId },
    data: { status: "COMPLETED", completedById: actorId, completedAt: new Date(), completionNote: data.note ?? null, proofUrl: data.proofUrl ?? null },
  })
  await createAuditLog({ userId: actorId, circleId, action: "CHORE_COMPLETED", entityType: "HouseholdChore", entityId: choreId, newValues: { status: "COMPLETED", note: data.note } })
  return updated
}

export async function skipChore(circleId: string, choreId: string, actorId: string, isManager: boolean) {
  const c = await prisma.householdChore.findFirst({ where: { id: choreId, circleId } })
  if (!c) throw new Error("Not found")
  if (!isManager && c.assigneeId !== actorId) throw new Error("You can only skip chores assigned to you")
  const updated = await prisma.householdChore.update({ where: { id: choreId }, data: { status: "SKIPPED" } })
  await createAuditLog({ userId: actorId, circleId, action: "CHORE_SKIPPED", entityType: "HouseholdChore", entityId: choreId })
  return updated
}

// Manager manual reassignment (never rewrites recorded history — origin kept via swappedFromId).
export async function reassignChore(circleId: string, choreId: string, actorId: string, newAssigneeId: string) {
  const c = await prisma.householdChore.findFirst({ where: { id: choreId, circleId } })
  if (!c) throw new Error("Not found")
  if (c.assigneeId !== newAssigneeId) {
    await prisma.householdChore.update({ where: { id: choreId }, data: { assigneeId: newAssigneeId, swappedFromId: c.swappedFromId || c.assigneeId } })
    await createAuditLog({ userId: actorId, circleId, action: "CHORE_REASSIGNED", entityType: "HouseholdChore", entityId: choreId, oldValues: { assigneeId: c.assigneeId }, newValues: { assigneeId: newAssigneeId } })
    await notifyOne(circleId, newAssigneeId, "CHORE_ASSIGNED", `Chore reassigned to you: ${c.title}`, "A responsibility was reassigned to you.")
  }
  return { ok: true }
}

export async function requestChoreSwap(circleId: string, choreId: string, actorId: string, toUserId: string, isManager: boolean, note?: string) {
  const c = await prisma.householdChore.findFirst({ where: { id: choreId, circleId } })
  if (!c) throw new Error("Not found")
  if (!isManager && c.assigneeId !== actorId) throw new Error("You can only request a swap on chores assigned to you")
  if (!toUserId || String(toUserId).trim() === "") throw new Error("A receiving member is required")
  const swap = await prisma.householdChoreSwap.create({
    data: { circleId, choreId, fromUserId: c.assigneeId || actorId, toUserId, requestedById: actorId, note: note ?? null, status: "PENDING" },
  })
  await notifyMany(circleId, [toUserId], "CHORE_SWAP_REQUEST", `Swap request: ${c.title}`, `${c.title} is offered to you.`, )
  await createAuditLog({ userId: actorId, circleId, action: "CHORE_SWAP_REQUESTED", entityType: "HouseholdChoreSwap", entityId: swap.id, newValues: { toUserId } })
  return swap
}

export async function decideChoreSwap(circleId: string, swapId: string, actorId: string, isManager: boolean, approve: boolean) {
  const swap = await prisma.householdChoreSwap.findFirst({ where: { id: swapId, circleId }, include: { chore: true } })
  if (!swap) throw new Error("Not found")
  if (swap.status !== "PENDING") throw new Error("Swap already decided")
  // Members cannot self-approve their own swap request.
  if (actorId === swap.requestedById && !isManager) throw new Error("You cannot approve your own swap request")
  if (!isManager && swap.toUserId !== actorId) throw new Error("Only the receiving member or a manager can decide a swap")

  const updated = await prisma.householdChoreSwap.update({
    where: { id: swapId },
    data: { status: approve ? "APPROVED" : "REJECTED", respondedById: actorId, respondedAt: new Date() },
  })
  if (approve) {
    await prisma.householdChore.update({ where: { id: swap.choreId }, data: { assigneeId: swap.toUserId, swappedFromId: swap.chore.swappedFromId || swap.fromUserId } })
  }
  await notifyMany(circleId, [swap.requestedById, swap.fromUserId], "CHORE_SWAP_DECISION", `Swap ${approve ? "approved" : "rejected"}: ${swap.chore.title}`, approve ? "The responsibility was swapped." : "The swap was declined.")
  await createAuditLog({ userId: actorId, circleId, action: approve ? "CHORE_SWAP_APPROVED" : "CHORE_SWAP_REJECTED", entityType: "HouseholdChoreSwap", entityId: swapId, newValues: { status: updated.status } })
  return updated
}

// Daily sweep: due/overdue reminders (deduped per instance) + status refresh.
export async function sweepHouseholdChores(circleId: string) {
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { type: true } })
  if (!circle || circle.type !== "HOUSEMATE") return []
  await ensureChoreGeneration(circleId).catch(() => {})
  const now = new Date()
  const chores = await prisma.householdChore.findMany({ where: { circleId, status: { notIn: ["COMPLETED", "SKIPPED"] } } })
  const reminded: string[] = []
  for (const c of chores) {
    if (!c.assigneeId) continue
    const due = c.dueDate ? new Date(c.dueDate) : null
    const intended = due && c.dueTime ? dueAt(due, c.dueTime) : due
    const status = intended ? computeChoreStatus(intended, c.status, now) : c.status
    const sent = (c.metadata as any)?.remindDate
    const today = now.toISOString().slice(0, 10)
    if (intended && (status === "OVERDUE" || status === "DUE") && sent !== today) {
      await notifyOne(circleId, c.assigneeId, status === "OVERDUE" ? "CHORE_OVERDUE" : "CHORE_DUE", `${c.title} ${status === "OVERDUE" ? "is overdue" : "is due today"}`, c.dueTime ? `Due at ${c.dueTime}.` : "Due today.")
      await prisma.householdChore.update({ where: { id: c.id }, data: { status, metadata: { ...((c.metadata as any) || {}), remindDate: today } } })
      reminded.push(`${c.id}:${status}`)
    } else if (intended && status !== c.status) {
      await prisma.householdChore.update({ where: { id: c.id }, data: { status } })
    }
  }
  return reminded
}