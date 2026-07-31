import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"
import {
  deleteContributionSchedule,
  updateContributionSchedule,
} from "@/lib/services/contribution-schedule.service"

const updateScheduleSchema = z.object({
  name: z.string().max(80).optional(),
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "CUSTOM"]).optional(),
  firstDueDate: z.string().min(1).optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  gracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  lateFee: z.coerce.number().min(0).optional().nullable(),
  autoGenerate: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string; scheduleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId, scheduleId } = await params
    const body = await req.json()
    const parsed = updateScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const schedule = await updateContributionSchedule(circleId, scheduleId, session.user.id, parsed.data)
    return NextResponse.json(schedule)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update schedule"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions" || msg === "Forbidden"
        ? 403
        : msg === "Schedule not found"
        ? 404
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; scheduleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId, scheduleId } = await params
    const result = await deleteContributionSchedule(circleId, scheduleId, session.user.id)
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete schedule"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions" || msg === "Forbidden"
        ? 403
        : msg === "Schedule not found"
        ? 404
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
