import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { changePassword } from "@/lib/services/profile.service"
import { changePasswordSchema } from "@/lib/validations/profile"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = changePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    await changePassword(session.user.id, parsed.data.currentPassword, parsed.data.newPassword)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed"
    return NextResponse.json({ error: msg }, { status: msg.includes("incorrect") || msg.includes("not enabled") ? 400 : 500 })
  }
}
