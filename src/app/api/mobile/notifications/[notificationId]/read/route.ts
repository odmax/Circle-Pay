import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUserFromRequest } from "@/lib/services/mobile-auth.service"

export async function POST(req: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  try {
    const user = await getMobileUserFromRequest(req)
    const { notificationId } = await params
    await prisma.notification.update({ where: { id: notificationId, userId: user.id }, data: { isRead: true } })
    return NextResponse.json({ ok: true })
  } catch (e: any) { return NextResponse.json({ error: e.message || "Unauthorized" }, { status: 401 }) }
}
