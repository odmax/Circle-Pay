import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canPerform } from "@/lib/ownerPermissions"
import { isPrimaryOwnerEmail } from "@/lib/owner-email"

export async function getCurrentInternalAdmin() {
  const session = await auth()
  if (!session?.user?.id) return { isAdmin: false, isPrimaryOwner: false, isActive: false }
  const admin = await prisma.internalAdmin.findUnique({ where: { userId: session.user.id } })
  if (!admin || !admin.isActive) {
    return { isAdmin: false, isPrimaryOwner: false, isActive: false }
  }
  const isPrimaryOwner = isPrimaryOwnerEmail(session.user.email)
  return {
    isAdmin: true, adminId: admin.id, role: admin.role as string,
    isPrimaryOwner, isActive: true,
    user: { id: session.user.id, name: session.user.name || null, email: session.user.email || "" },
  }
}

export async function canManageAdmin(actorAdminId: string, targetAdminId: string, action: "edit-role" | "deactivate" | "remove"): Promise<{ allowed: boolean; reason?: string }> {
  const actor = await prisma.internalAdmin.findUnique({ where: { id: actorAdminId } })
  const target = await prisma.internalAdmin.findUnique({ where: { id: targetAdminId }, include: { user: { select: { email: true } } } })
  if (!actor || !actor.isActive) return { allowed: false, reason: "Your admin account is not active" }
  if (!target) return { allowed: false, reason: "Target admin not found" }

  const targetIsPrimary = isPrimaryOwnerEmail(target.user.email)

  // No one can touch the primary owner
  if (targetIsPrimary) return { allowed: false, reason: "You cannot modify the primary owner" }

  // Cannot modify self
  if (actor.id === target.id) return { allowed: false, reason: "You cannot change your own administrative role" }

  // Only SUPER_ADMIN can manage other admins
  if (actor.role !== "SUPER_ADMIN") return { allowed: false, reason: "Only SUPER_ADMIN can manage admins" }

  // Cannot remove/demote last active SUPER_ADMIN
  if (action === "deactivate" || action === "remove") {
    if (target.role === "SUPER_ADMIN") {
      const superCount = await prisma.internalAdmin.count({ where: { role: "SUPER_ADMIN", isActive: true } })
      if (superCount <= 1) return { allowed: false, reason: "At least one active SUPER_ADMIN must remain" }
    }
  }

  return { allowed: true }
}

export async function requireOwnerPermission(userId: string, action: string) {
  const admin = await prisma.internalAdmin.findUnique({ where: { userId }, select: { role: true, isActive: true } })
  if (!admin || !admin.isActive) throw new Error("Forbidden")
  if (!canPerform(admin.role, action)) throw new Error("Insufficient permissions")
}

export async function requireOwnerAdmin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const admin = await prisma.internalAdmin.findUnique({ where: { userId: session.user.id } })
  if (!admin || !admin.isActive) throw new Error("Forbidden")
  return session.user.id
}

export async function requireOwnerPage(action: string): Promise<string> {
  const uid = await requireOwnerAdmin()
  const admin = await prisma.internalAdmin.findUnique({ where: { userId: uid }, select: { role: true } })
  if (!admin || !canPerform(admin.role, action)) throw new Error("Insufficient permissions")
  return uid
}

export async function requireOwnerAction(action: string): Promise<string> {
  return requireOwnerPage(action)
}

export async function getOwnerUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, image: true, currency: true,
      isSuspended: true, suspendedAt: true, suspensionReason: true,
      createdAt: true, updatedAt: true,
      subscription: { include: { plan: { select: { name: true, slug: true } } } },
      _count: { select: { circleMembers: true } },
      paymentTransactions: { take: 5, orderBy: { createdAt: "desc" }, include: { plan: { select: { name: true } } } },
      internalAdmin: true,
      circleMembers: { take: 10, include: { circle: { select: { id: true, name: true, type: true } } } },
    },
  })
  if (!user) throw new Error("User not found")
  return user
}

export async function getOwnerNotes(targetType: string, targetId: string) {
  return prisma.ownerNote.findMany({
    where: { targetType, targetId },
    include: { admin: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function createOwnerNote(adminId: string, targetType: string, targetId: string, note: string) {
  return prisma.ownerNote.create({ data: { adminId, targetType, targetId, note } })
}
