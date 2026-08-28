import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getLoanConfig, upsertLoanConfig } from "@/lib/services/loan.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  try {
    const config = await getLoanConfig(circleId, session.user.id)
    return NextResponse.json({ config })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch loan config"
    const status = message.includes("denied") ? 403 : message.includes("Not a member") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  try {
    const config = await upsertLoanConfig(circleId, session.user.id, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      minLoanAmount: typeof body.minLoanAmount === "number" ? body.minLoanAmount : undefined,
      maxLoanAmount: typeof body.maxLoanAmount === "number" ? body.maxLoanAmount : undefined,
      maxTotalLoansOutstanding: typeof body.maxTotalLoansOutstanding === "number" ? body.maxTotalLoansOutstanding : undefined,
      maxActiveLoansPerMember: typeof body.maxActiveLoansPerMember === "number" ? body.maxActiveLoansPerMember : undefined,
      interestRate: typeof body.interestRate === "number" ? body.interestRate : undefined,
      serviceFeePercent: typeof body.serviceFeePercent === "number" ? body.serviceFeePercent : undefined,
      maxRepaymentTermMonths: typeof body.maxRepaymentTermMonths === "number" ? body.maxRepaymentTermMonths : undefined,
      gracePeriodDays: typeof body.gracePeriodDays === "number" ? body.gracePeriodDays : undefined,
      lateFeePercent: typeof body.lateFeePercent === "number" ? body.lateFeePercent : undefined,
      allowsMemberInitiated: typeof body.allowsMemberInitiated === "boolean" ? body.allowsMemberInitiated : undefined,
      requiresApproval: typeof body.requiresApproval === "boolean" ? body.requiresApproval : undefined,
      autoConfirmRepayments: typeof body.autoConfirmRepayments === "boolean" ? body.autoConfirmRepayments : undefined,
      defaultRepaymentFrequency:
        body.defaultRepaymentFrequency === "WEEKLY" || body.defaultRepaymentFrequency === "MONTHLY" || body.defaultRepaymentFrequency === "QUARTERLY"
          ? body.defaultRepaymentFrequency
          : undefined,
    })
    return NextResponse.json({ config }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update loan config"
    const status = message.includes("denied") ? 403 : message.includes("Not a member") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
