import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ownerExists: false, message: "Not authenticated" })

  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase()
  if (!ownerEmail) return NextResponse.json({ ownerExists: false, message: "OWNER_EMAIL not configured" })

  const isOwner = session.user.email?.toLowerCase() === ownerEmail
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

  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase()
  if (!ownerEmail) return NextResponse.json({ error: "OWNER_EMAIL not configured" }, { status: 500 })
  if (session.user.email?.toLowerCase() !== ownerEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const existing = await prisma.internalAdmin.findUnique({ where: { userId: session.user.id } })
  if (existing) return NextResponse.json({ role: existing.role, message: "Already an admin" })

  const admin = await prisma.internalAdmin.create({ data: { userId: session.user.id, role: "SUPER_ADMIN" } })
  return NextResponse.json({ role: admin.role, message: "Owner bootstrapped" }, { status: 201 })
}
