import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { removeMember, updateMemberRole } from "@/lib/services/circle.service"
import { updateMemberRoleSchema } from "@/lib/validations/circles"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; memberId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, memberId } = await params
    const body = await req.json()
    const parsed = updateMemberRoleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const updated = await updateMemberRole(
      circleId,
      session.user.id,
      memberId,
      parsed.data.role
    )
    return NextResponse.json(updated)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update role"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions"
        ? 403
        : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ circleId: string; memberId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId, memberId } = await params
    await removeMember(circleId, session.user.id, memberId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to remove member"
    const status =
      msg === "Not a member of this circle" ||
      msg === "Insufficient permissions" ||
      msg === "Cannot remove the last owner of the circle"
        ? 403
        : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
