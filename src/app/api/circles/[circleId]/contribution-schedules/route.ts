import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"
import {
  createContributionSchedule,
  getContributionSchedules,
} from "@/lib/services/contribution-schedule.service"

const createScheduleSchema = z.object({
  name: z.string().max(80).optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "CUSTOM"]),
  firstDueDate: z.string().min(1, "First due date is required"),
  dueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  gracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  lateFee: z.coerce.number().min(0).optional().nullable(),
  autoGenerate: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId } = await params
    const schedules = await getContributionSchedules(circleId, session.user.id)
    return NextResponse.json(schedules)
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch schedules"
    return NextResponse.json({ error: msg }, { status: msg === "Forbidden" ? 403 : 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { circleId } = await params
    const body = await req.json()
    const parsed = createScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const schedule = await createContributionSchedule(circleId, session.user.id, parsed.data)
    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create schedule"
    const status =
      msg === "Not a member of this circle" || msg === "Insufficient permissions" || msg === "Forbidden"
        ? 403
        : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
