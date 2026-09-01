/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/services/audit.service"

function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const DAY = 86400000

export function computeLeaseStatus(endDate: string | Date | null, today = new Date()): string {
  if (!endDate) return "DRAFT"
  const end = new Date(endDate)
  if (end.getTime() < today.getTime()) return "ENDED"
  if (end.getTime() - today.getTime() <= 60 * DAY) return "EXPIRING"
  return "ACTIVE"
}

export function computeOccupancyActive(moveIn: Date, moveOut: Date | null, now = new Date()): boolean {
  return moveIn.getTime() <= now.getTime() && (!moveOut || moveOut.getTime() > now.getTime())
}

export function computeRentSplit(input: {
  monthlyRent: number
  rooms: Array<{ id: string; name: string; rentShare: number | null }>
  occupantByRoom: Record<string, string>
  members: string[]
}): Record<string, number> {
  const split: Record<string, number> = {}
  const byRoom = input.rooms.some((r) => (r.rentShare ?? 0) > 0)
  if (byRoom) {
    for (const r of input.rooms) {
      const occupant = input.occupantByRoom[r.id]
      if (occupant) split[occupant] = Math.round((split[occupant] || 0) + asNum(r.rentShare))
    }
    return split
  }
  const ids = input.members.length ? input.members : Object.keys(input.occupantByRoom)
  if (!ids.length) return split
  const base = Math.floor((input.monthlyRent / ids.length) * 100) / 100
  for (let i = 0; i < ids.length; i++) split[ids[i]] = i === ids.length - 1 ? Math.round((input.monthlyRent - base * (ids.length - 1)) * 100) / 100 : base
  return split
}

// ─── Reads ──────────────────────────────────────────────────

export async function getLeaseRooms(circleId: string, viewerId: string) {
  const [lease, rooms, occupancies, deposits, members] = await Promise.all([
    prisma.householdLease.findUnique({ where: { circleId } }),
    prisma.householdRoom.findMany({ where: { circleId }, orderBy: { name: "asc" } }),
    prisma.householdRoomOccupancy.findMany({ where: { circleId }, include: { member: { select: { name: true } } }, orderBy: { moveIn: "asc" } }),
    prisma.householdDeposit.findMany({ where: { circleId }, include: { member: { select: { name: true } } } }),
    prisma.circleMember.findMany({ where: { circleId }, select: { userId: true } }),
  ])

  const now = new Date()
  const active = (o: typeof occupancies[number]) => computeOccupancyActive(o.moveIn, o.moveOut, now)
  const activeOccs = occupancies.filter(active)
  const occupantByRoom: Record<string, string> = {}
  for (const o of activeOccs) occupantByRoom[o.roomId] = o.memberId
  const memberOfRoom: Record<string, { roomId: string; roomName: string; moveIn: string; moveOut: string | null; rentShareAt: number | null } | null> = {}
  for (const o of activeOccs) {
    const room = rooms.find((r) => r.id === o.roomId)
    memberOfRoom[o.memberId] = { roomId: o.roomId, roomName: room?.name ?? "Room", moveIn: o.moveIn.toISOString(), moveOut: o.moveOut ? o.moveOut.toISOString() : null, rentShareAt: o.rentShareAt != null ? asNum(o.rentShareAt) : null }
  }

  const monthlyRent = lease ? asNum(lease.monthlyRent) : 0
  const splits = computeRentSplit({ monthlyRent, rooms: rooms.map((r) => ({ id: r.id, name: r.name, rentShare: r.monthlyRentShare != null ? asNum(r.monthlyRentShare) : null })), occupantByRoom, members: members.map((m) => m.userId) })
  const myRoom = memberOfRoom[viewerId] ?? null
  const myRentShare = Math.round((splits[viewerId] || 0) * 100) / 100
  const myDeposit = deposits.find((d) => d.memberId === viewerId) ?? null

  const nowMs = now.getTime()
  const daysLeft = lease?.leaseEnd ? Math.max(0, Math.round((new Date(lease.leaseEnd).getTime() - nowMs) / DAY)) : null
  const vacantRooms = rooms.filter((r) => !occupantByRoom[r.id])
  const upcomingMoveOuts = activeOccs
    .filter((o) => o.moveOut && o.moveOut.getTime() - nowMs <= 30 * DAY && o.moveOut.getTime() > nowMs)
    .map((o) => ({ memberName: o.member?.name ?? o.memberId, moveOut: (o.moveOut as Date).toISOString() }))
  const refundsDue = deposits
    .filter((d) => asNum(d.refundDue) > 0 && asNum(d.refundDue) > asNum(d.refundPaid))
    .map((d) => ({ memberId: d.memberId, memberName: d.member?.name ?? d.memberId, due: Math.round(asNum(d.refundDue) - asNum(d.refundPaid)), refunded: asNum(d.refundPaid) > 0 }))

  const myDepositView = myDeposit ? {
    expected: asNum(myDeposit.expected), paid: asNum(myDeposit.paid), paidAt: myDeposit.paidAt ? myDeposit.paidAt.toISOString() : null,
    paidProofUrl: myDeposit.paidProofUrl, deductions: asNum(myDeposit.deductions), refundDue: asNum(myDeposit.refundDue), refundPaid: asNum(myDeposit.refundPaid),
    status: myDeposit.status, refundProofUrl: myDeposit.refundProofUrl,
  } : null

  const alerts: Array<{ id: string; level: string; title: string; description: string }> = []
  if (lease && lease.leaseEnd) {
    const status = computeLeaseStatus(lease.leaseEnd, now)
    if (status === "EXPIRING") alerts.push({ id: "lease-expiring", level: "warning", title: "Lease expiring soon", description: daysLeft != null ? `${daysLeft} day(s) left on the lease.` : "" })
    if (status === "ENDED") alerts.push({ id: "lease-ended", level: "risk", title: "Lease has ended", description: "Renew or end the lease." })
    if (lease.renewalDate && new Date(lease.renewalDate).getTime() - nowMs <= 30 * DAY) alerts.push({ id: "renewal", level: "info", title: "Renewal approaching", description: `Renewal date ${new Date(lease.renewalDate).toDateString()}.` })
  }
  for (const d of deposits) if (asNum(d.expected) > asNum(d.paid)) alerts.push({ id: `dep-${d.memberId}`, level: "warning", title: "Deposit outstanding", description: `${d.member?.name ?? d.memberId} still owes deposit.` })
  for (const o of activeOccs) {
    const inDays = Math.round((o.moveIn.getTime() - nowMs) / DAY)
    if (o.moveIn.getTime() > nowMs && inDays <= 7) alerts.push({ id: `movein-${o.id}`, level: "info", title: "Move-in approaching", description: `${o.member?.name ?? o.memberId} moves in within ${inDays} day(s).` })
  }
  for (const o of upcomingMoveOuts) alerts.push({ id: `moveout-${o.memberName}`, level: "info", title: "Move-out approaching", description: `${o.memberName} moves out soon.` })
  for (const r of refundsDue) alerts.push({ id: `refund-${r.memberId}`, level: "info", title: "Deposit refund ready", description: `${r.memberName} is owed ${r.due}.` })

  return {
    lease: lease ? {
      id: lease.id, leaseStart: lease.leaseStart ? lease.leaseStart.toISOString() : null, leaseEnd: lease.leaseEnd ? lease.leaseEnd.toISOString() : null,
      landlordAgent: lease.landlordAgent, monthlyRent, depositTotal: asNum(lease.depositTotal), noticePeriodDays: lease.noticePeriodDays, renewalDate: lease.renewalDate ? lease.renewalDate.toISOString() : null,
      leaseDocUrl: lease.leaseDocUrl, status: lease.status,
    } : null,
    leaseStatus: lease && lease.leaseEnd ? computeLeaseStatus(lease.leaseEnd, now) : null,
    daysLeft,
    rooms: rooms.map((r) => ({ id: r.id, name: r.name, rentShare: r.monthlyRentShare != null ? asNum(r.monthlyRentShare) : null, depositShare: r.depositShare != null ? asNum(r.depositShare) : null, capacity: r.capacity, notes: r.notes, occupantId: occupantByRoom[r.id] ?? null, vacant: !occupantByRoom[r.id] })),
    splits,
    my: { room: myRoom, rentShare: myRentShare, deposit: myDepositView },
    deposits: deposits.map((d) => ({ memberId: d.memberId, memberName: d.member?.name ?? d.memberId, expected: asNum(d.expected), paid: asNum(d.paid), deductions: asNum(d.deductions), refundDue: asNum(d.refundDue), refundPaid: asNum(d.refundPaid), status: d.status, paidProofUrl: d.paidProofUrl, refundProofUrl: d.refundProofUrl })),
    vacantRooms: vacantRooms.length,
    upcomingMoveOuts,
    refundsDue,
    occupancyHistoryCount: occupancies.length,
    alerts,
  }
}

// ─── Lease & Rooms (manager) ───────────────────────────────

const LEASE_FIELDS = ["leaseStart", "leaseEnd", "landlordAgent", "monthlyRent", "depositTotal", "noticePeriodDays", "renewalDate", "leaseDocUrl", "status"]

export async function upsertHouseholdLease(circleId: string, userId: string, data: any) {
  const safe: any = {}
  for (const k of LEASE_FIELDS) {
    if (data[k] === undefined) continue
    if (k === "leaseStart" || k === "leaseEnd" || k === "renewalDate") safe[k] = data[k] ? new Date(String(data[k])) : null
    else if (k === "monthlyRent" || k === "depositTotal") safe[k] = data[k] ? asNum(data[k]) : null
    else if (k === "noticePeriodDays") safe[k] = data[k] != null ? Number(data[k]) : null
    else if (data[k] === "" || data[k] === null) safe[k] = null
    else safe[k] = data[k]
  }
  if (safe.leaseEnd) safe.status = computeLeaseStatus(safe.leaseEnd) as any
  const lease = await prisma.householdLease.upsert({ where: { circleId }, create: { circleId, createdById: userId, ...safe }, update: { ...safe } })
  await createAuditLog({ userId, circleId, action: "LEASE_UPDATED", entityType: "HouseholdLease", entityId: lease.id, newValues: safe })
  return lease
}

export async function setLeaseStatus(circleId: string, userId: string, status: string) {
  const allowed = ["DRAFT", "ACTIVE", "EXPIRING", "ENDED"]
  if (!allowed.includes(status)) throw new Error("Invalid lease status")
  const lease = await prisma.householdLease.update({ where: { circleId }, data: { status: status as any } })
  await createAuditLog({ userId, circleId, action: "LEASE_STATUS", entityType: "HouseholdLease", entityId: lease.id, newValues: { status } })
  return lease
}

export async function createHouseholdRoom(circleId: string, userId: string, data: any) {
  const name = (data.name || "").trim()
  if (!name) throw new Error("Room name is required")
  const room = await prisma.householdRoom.create({
    data: { circleId, name, monthlyRentShare: data.monthlyRentShare != null ? asNum(data.monthlyRentShare) : null, depositShare: data.depositShare != null ? asNum(data.depositShare) : null, capacity: Number(data.capacity) || 1, notes: data.notes ?? null },
  })
  await createAuditLog({ userId, circleId, action: "ROOM_CREATED", entityType: "HouseholdRoom", entityId: room.id, newValues: { name } })
  return room
}

export async function updateHouseholdRoom(circleId: string, roomId: string, userId: string, data: any) {
  const room = await prisma.householdRoom.findFirst({ where: { id: roomId, circleId } })
  if (!room) throw new Error("Not found")
  const safe: any = {}
  for (const k of ["name", "monthlyRentShare", "depositShare", "capacity", "notes"]) if (data[k] !== undefined) safe[k] = data[k]
  if (safe.monthlyRentShare != null) safe.monthlyRentShare = asNum(safe.monthlyRentShare)
  if (safe.depositShare != null) safe.depositShare = asNum(safe.depositShare)
  const updated = await prisma.householdRoom.update({ where: { id: roomId }, data: safe })
  await createAuditLog({ userId, circleId, action: "ROOM_UPDATED", entityType: "HouseholdRoom", entityId: roomId, newValues: safe })
  return updated
}

export async function deleteHouseholdRoom(circleId: string, roomId: string, userId: string) {
  const room = await prisma.householdRoom.findFirst({ where: { id: roomId, circleId }, include: { occupancies: true } })
  if (!room) throw new Error("Not found")
  const activeCount = room.occupancies.filter((o) => !o.moveOut || o.moveOut > new Date()).length
  if (activeCount > 0) throw new Error("Cannot delete a room with active occupants")
  await prisma.householdRoom.delete({ where: { id: roomId } })
  await createAuditLog({ userId, circleId, action: "ROOM_DELETED", entityType: "HouseholdRoom", entityId: roomId })
  return { ok: true }
}

// Assign occupancy (manager). Historical rows are never rewritten — prior active
// occupancy is closed with moveOut=now and a new row records the assignment.
export async function assignRoomOccupancy(circleId: string, roomId: string, actorId: string, memberId: string, opts: { moveIn?: string | null; moveOut?: string | null }) {
  const room = await prisma.householdRoom.findFirst({ where: { id: roomId, circleId } })
  const member = await prisma.circleMember.findFirst({ where: { circleId, userId: memberId } })
  if (!room || !member) throw new Error("Not found")
  const now = new Date()
  // Close any other active occupancy for this member (historical preserved).
  await prisma.householdRoomOccupancy.updateMany({ where: { circleId, memberId, moveOut: null }, data: { moveOut: now } })
  // Close the previous occupant of this room.
  await prisma.householdRoomOccupancy.updateMany({ where: { roomId, moveOut: null }, data: { moveOut: now } })

  const moveIn = opts.moveIn ? new Date(opts.moveIn) : now
  const occ = await prisma.householdRoomOccupancy.create({
    data: { roomId, circleId, memberId, moveIn, moveOut: opts.moveOut ? new Date(opts.moveOut) : null, rentShareAt: room.monthlyRentShare != null ? room.monthlyRentShare : null },
  })
  await createAuditLog({ userId: actorId, circleId, action: "ROOM_ASSIGNED", entityType: "HouseholdRoomOccupancy", entityId: occ.id, newValues: { roomId, memberId, moveIn } })
  const { createNotification } = await import("@/lib/services/notification.service")
  await createNotification({ userId: memberId, circleId, type: "FEED_POST_CREATED", title: `Room assigned: ${room.name}`, message: `You were assigned ${room.name}.`, link: `/circles/${circleId}/lease` }).catch(() => {})
  return occ
}

export async function clearRoomOccupant(circleId: string, roomId: string, actorId: string, memberId: string) {
  const occ = await prisma.householdRoomOccupancy.findFirst({ where: { roomId, circleId, memberId, moveOut: null } })
  if (!occ) throw new Error("No active occupancy found")
  const updated = await prisma.householdRoomOccupancy.update({ where: { id: occ.id }, data: { moveOut: new Date() } })
  await createAuditLog({ userId: actorId, circleId, action: "ROOM_CLEARED", entityType: "HouseholdRoomOccupancy", entityId: occ.id, newValues: { moveOut: new Date().toISOString() } })
  return updated
}

// ─── Deposits ───────────────────────────────────────────────

export async function recordDepositPaid(circleId: string, memberId: string, actorId: string, isManager: boolean, data: { amount: number; proofUrl?: string }) {
  const member = await prisma.circleMember.findFirst({ where: { circleId, userId: memberId } })
  if (!member) throw new Error("Not found")
  if (!isManager && memberId !== actorId) throw new Error("You can only record your own deposit")
  const existing = await prisma.householdDeposit.findUnique({ where: { circleId_memberId: { circleId, memberId } } })
  const expected = existing ? asNum(existing.expected) : Math.max(0, data.amount)
  // Idempotent: a fully-paid deposit does not repost.
  if (existing && asNum(existing.paid) > 0 && existing.status === "PAID") return existing
  const deposit = existing
    ? await prisma.householdDeposit.update({ where: { id: existing.id }, data: { expected, paid: data.amount, paidAt: new Date(), paidProofUrl: data.proofUrl ?? existing.paidProofUrl, status: "PAID" } })
    : await prisma.householdDeposit.create({ data: { circleId, memberId, expected, paid: data.amount, paidAt: new Date(), paidProofUrl: data.proofUrl ?? null, status: "PAID" } })
  await createAuditLog({ userId: actorId, circleId, action: "DEPOSIT_PAID", entityType: "HouseholdDeposit", entityId: deposit.id, newValues: { memberId, amount: data.amount } })
  return deposit
}

export async function finalizeDepositRefund(circleId: string, memberId: string, actorId: string, isManager: boolean, deductions: number) {
  const deposit = await prisma.householdDeposit.findUnique({ where: { circleId_memberId: { circleId, memberId } } })
  if (!deposit) throw new Error("Deposit not recorded")
  const refundDue = Math.max(0, asNum(deposit.paid) - Math.max(0, deductions))
  const updated = await prisma.householdDeposit.update({ where: { id: deposit.id }, data: { deductions: Math.max(0, deductions), refundDue } })
  await createAuditLog({ userId: actorId, circleId, action: "DEPOSIT_FINALIZED", entityType: "HouseholdDeposit", entityId: deposit.id, newValues: { deductions, refundDue } })
  return updated
}

export async function recordDepositRefund(circleId: string, memberId: string, actorId: string, isManager: boolean, data: { amount: number; proofUrl?: string }) {
  const deposit = await prisma.householdDeposit.findUnique({ where: { circleId_memberId: { circleId, memberId } } })
  if (!deposit) throw new Error("Deposit not recorded")
  if (!isManager && memberId !== actorId) throw new Error("You can only record your own refund")
  if (deposit.status === "REFUNDED") return deposit // idempotent
  const refundDue = asNum(deposit.refundDue) || Math.max(0, asNum(deposit.paid) - asNum(deposit.deductions))
  if (data.amount > refundDue) throw new Error("Refund cannot exceed the refund due")
  const updated = await prisma.householdDeposit.update({
    where: { id: deposit.id },
    data: { refundPaid: data.amount, refundPaidAt: new Date(), refundProofUrl: data.proofUrl ?? deposit.refundProofUrl, status: data.amount >= refundDue ? "REFUNDED" : "PAID" },
  })
  await createAuditLog({ userId: actorId, circleId, action: "DEPOSIT_REFUNDED", entityType: "HouseholdDeposit", entityId: deposit.id, newValues: { memberId, amount: data.amount } })
  return updated
}