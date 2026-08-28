import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { CURRENCIES } from "@/lib/constants"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { LoansClient, type LoansPermissions } from "@/components/loans/loans-client"

export default async function LoansPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  const symbol =
    CURRENCIES.find((c) => c.code === circle.currency)?.symbol ?? circle.currency

  const canApply = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.LOAN_APPLY,
  })
  const canViewAll = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.LOAN_VIEW_ALL,
  })
  const canReview = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.LOAN_REVIEW,
  })
  const canApprove = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.LOAN_APPROVE,
  })
  const canDisburse = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.LOAN_DISBURSE,
  })
  const canReviewRepayments = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW,
  })
  const canManageConfig = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.LOAN_CONFIG_MANAGE,
  })

  const permissions: LoansPermissions = {
    canApply,
    canViewAll,
    canReview,
    canApprove,
    canDisburse,
    canReviewRepayments,
    canManageConfig,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          render={
            <Link href={`/circles/${circleId}/stokvel`} data-loa-back />
          }
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loans</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <LoansClient
        circleId={circleId}
        userId={session.user.id}
        symbol={symbol}
        permissions={permissions}
      />
    </div>
  )
}
