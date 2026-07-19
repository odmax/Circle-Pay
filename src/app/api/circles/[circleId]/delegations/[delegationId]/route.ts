import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { revokeDelegation } from "@/lib/services/delegation.service"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string; delegationId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { delegationId } = await params

  try {
    await revokeDelegation({ delegationId, userId: session.user.id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error revoking delegation:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revoke delegation" },
      { status: 500 }
    )
  }
}
