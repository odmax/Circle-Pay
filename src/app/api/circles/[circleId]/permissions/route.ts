import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  setMemberPermissionOverride,
  removeMemberPermissionOverride,
} from "@/lib/services/circle-permission.service"
import type { CirclePermission } from "@/lib/permissions/circlePermissions"

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
    const { membershipId, permission, granted } = body as {
      membershipId: string
      permission: CirclePermission
      granted: boolean
    }

    if (!membershipId || !permission || typeof granted !== "boolean") {
      return NextResponse.json(
        { error: "membershipId, permission, and granted are required" },
        { status: 400 }
      )
    }

    const override = await setMemberPermissionOverride({
      circleId,
      membershipId,
      permission,
      granted,
      actorUserId: session.user.id,
    })

    return NextResponse.json(override)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to set permission"
    const status =
      msg.includes("Not a member") || msg.includes("Insufficient permissions") || msg.includes("Cannot deny")
        ? 403
        : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
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
    const { membershipId, permission } = body as {
      membershipId: string
      permission: CirclePermission
    }

    if (!membershipId || !permission) {
      return NextResponse.json(
        { error: "membershipId and permission are required" },
        { status: 400 }
      )
    }

    const result = await removeMemberPermissionOverride({
      circleId,
      membershipId,
      permission,
      actorUserId: session.user.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to remove permission"
    const status =
      msg.includes("Not a member") || msg.includes("Insufficient permissions")
        ? 403
        : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
