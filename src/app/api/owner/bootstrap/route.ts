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

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase()
  if (!ownerEmail) return NextResponse.json({ error: "OWNER_EMAIL not configured" }, { status: 500 })
  if (session.user.email?.trim().toLowerCase() !== ownerEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = await prisma.internalAdmin.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, role: "SUPER_ADMIN" },
    update: { isActive: true },
  })

  return NextResponse.json({ success: true, isAdmin: true, role: admin.role, message: "Owner access active" })
}
