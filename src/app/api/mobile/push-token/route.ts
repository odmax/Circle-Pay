import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUserFromRequest } from "@/lib/services/mobile-auth.service"

export async function POST(req: Request) {
  try {
    const user = await getMobileUserFromRequest(req)
    const { token, platform, deviceId } = await req.json()
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

    // Deactivate old tokens for same device
    if (deviceId) {
      await prisma.mobilePushToken.updateMany({ where: { userId: user.id, deviceId, isActive: true }, data: { isActive: false } })
    }

    // Upsert token
    await prisma.mobilePushToken.upsert({
      where: { token },
      create: { userId: user.id, token, platform: platform || null, deviceId: deviceId || null, lastUsedAt: new Date() },
      update: { isActive: true, lastUsedAt: new Date(), userId: user.id },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}
