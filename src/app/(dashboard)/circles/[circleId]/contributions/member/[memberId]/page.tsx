import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, PiggyBank, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { prisma } from "@/lib/prisma"
import {
  getMemberOwnContributions,
  getMemberOwnContributionStats,
  getMemberContributionsForAdmin,
} from "@/lib/services/contribution.service"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { ContributionHistoryTable } from "@/components/contributions/contribution-history-table"
import { CURRENCIES } from "@/lib/constants"

export default async function MemberContributionPage({
  params,
}: {
  params: Promise<{ circleId: string; memberId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId, memberId } = await params

  let circle: any
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }
  if (!circle) notFound()

  const currency = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = currency?.symbol ?? circle.currency ?? "R"

  const isOwn = session.user.id === memberId
  const canViewAll = await hasCirclePermission({
    userId: session.user.id,
    circleId,
    permission: CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL,
  })

  if (!isOwn && !canViewAll) {
    notFound()
  }

  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: memberId } },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })
  if (!member) notFound()

  const displayName = member.user.name || member.user.email

  let contributions: any[] = []
  let ownStats: any = null

  try {
    if (canViewAll) {
      contributions = await getMemberContributionsForAdmin(circleId, session.user.id, memberId)
    } else {
      ;[contributions, ownStats] = await Promise.all([
        getMemberOwnContributions(circleId, memberId),
        getMemberOwnContributionStats(circleId, memberId),
      ])
    }
  } catch (e) {
    console.error("Member contributions error:", e)
  }

  const plansForForm =
    circle.contributionPlans?.map((p: any) => ({ id: p.id, name: p.name })) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          render={<Link href={`/circles/${circleId}/contributions`} />}
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isOwn ? "My Contributions" : `${displayName}'s Contributions`}
          </h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      {/* Member Stats (own view only) */}
      {ownStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
              <PiggyBank className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {symbol}{ownStats.totalPaid.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <Clock className="size-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {symbol}{ownStats.totalPending.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
              <AlertTriangle className="size-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {symbol}{ownStats.outstanding.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Due / Overdue</CardTitle>
              <AlertTriangle className="size-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {symbol}{(ownStats.due + ownStats.overdue).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contribution History */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <CardTitle className="text-base">
            Contribution History ({contributions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <ContributionHistoryTable
            circleId={circleId}
            contributions={contributions}
            currencySymbol={symbol}
            plans={plansForForm}
            canManage={canViewAll}
          />
        </CardContent>
      </Card>
    </div>
  )
}
