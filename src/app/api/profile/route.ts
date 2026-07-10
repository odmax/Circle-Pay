import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getProfile, updateProfile } from "@/lib/services/profile.service"
import { updateProfileSchema } from "@/lib/validations/profile"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const profile = await getProfile(session.user.id)
    return NextResponse.json(profile)
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const result = await updateProfile(session.user.id, parsed.data)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
