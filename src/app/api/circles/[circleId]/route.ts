import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getCircleById,
  updateCircle,
  deleteCircle,
} from "@/lib/services/circle.service"
import { updateCircleSchema } from "@/lib/validations/circles"

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
    const circle = await getCircleById(circleId, session.user.id)
    return NextResponse.json(circle)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch circle"
    const status = msg === "Not a member of this circle" ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(
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
    const parsed = updateCircleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const circle = await updateCircle(circleId, session.user.id, parsed.data)
    return NextResponse.json(circle)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update circle"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions"
        ? 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { circleId } = await params
    await deleteCircle(circleId, session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete circle"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions"
        ? 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
