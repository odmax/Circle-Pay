import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleMembers, addMember } from "@/lib/services/circle.service"
import { addMemberSchema } from "@/lib/validations/circles"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const members = await getCircleMembers(circleId, session.user.id)
    return NextResponse.json(members)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch members"
    const status = msg === "Not a member of this circle" ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    const body = await req.json()
    const parsed = addMemberSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const member = await addMember(
      circleId,
      session.user.id,
      parsed.data.email,
      parsed.data.role
    )
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to add member"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions"
        ? 403
        : msg === "User with this email not found" || msg === "User is already a member"
          ? 400
          : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
