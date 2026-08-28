import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getLoan } from "@/lib/services/loan.service"
import { CURRENCIES } from "@/lib/constants"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { LoanDetailClient, type LoanDetailPermissions } from "@/components/loans/loan-detail-client"

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; loanId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId, loanId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  const symbol =
    CURRENCIES.find((c) => c.code === circle.currency)?.symbol ?? circle.currency

  let loan: Awaited<ReturnType<typeof getLoan>>
  try {
    loan = await getLoan(circleId, loanId, session.user.id)
  } catch {
    notFound()
  }

  const [canApply, canApprove, canDisburse, canReviewRepayments, canReview] = await Promise.all([
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.LOAN_APPLY }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.LOAN_APPROVE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.LOAN_DISBURSE }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW }),
    hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.LOAN_REVIEW }),
  ])

  const permissions: LoanDetailPermissions = {
    isOwner: loan.memberId === session.user.id,
    canApply,
    canApprove,
    canDisburse,
    canReviewRepayments,
    canReview,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          render={<Link href={`/circles/${circleId}/loans`} />}
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <LoanDetailClient
        circleId={circleId}
        loanId={loanId}
        userId={session.user.id}
        symbol={symbol}
        permissions={permissions}
      />
    </div>
  )
}
