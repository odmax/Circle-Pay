import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPrimaryOwnerEmail } from "@/lib/owner-email"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ownerExists: false, message: "Not authenticated" })

  const isOwner = isPrimaryOwnerEmail(session.user.email)
  const admin = await prisma.internalAdmin.findUnique({ where: { userId: session.user.id } })

  return NextResponse.json({
    ownerExists: !!admin && admin.role === "SUPER_ADMIN" && admin.isActive,
    isOwnerEmail: isOwner,
    message: admin ? "Admin account active" : "Use POST to bootstrap",
  })
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isPrimaryOwnerEmail(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = await prisma.internalAdmin.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, role: "SUPER_ADMIN" },
    update: { isActive: true },
  })

  return NextResponse.json({ success: true, isAdmin: true, role: admin.role, message: "Owner access active" })
}
