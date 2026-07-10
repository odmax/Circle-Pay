import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserCircles, createCircle } from "@/lib/services/circle.service"
import { createCircleSchema } from "@/lib/validations/circles"
import { enforceCircleLimit } from "@/lib/services/feature-gate.service"
import { applyCircleTemplate } from "@/lib/services/circle-template.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const circles = await getUserCircles(session.user.id)
    return NextResponse.json(circles)
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch circles" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await enforceCircleLimit(session.user.id)

    const body = await req.json()
    const parsed = createCircleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    if ((body as Record<string, unknown>).visibility === "PUBLIC") {
      const { hasFeature } = await import("@/lib/services/feature-gate.service")
      if (!await hasFeature(session.user.id, "PUBLIC_CIRCLES")) {
        return NextResponse.json({ error: "Public circles require a paid plan" }, { status: 403 })
      }
    }

    const circle = await createCircle(session.user.id, parsed.data)
    applyCircleTemplate(circle.id, session.user.id).catch(console.error)
    return NextResponse.json(circle, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create circle" },
      { status: 500 }
    )
  }
}
