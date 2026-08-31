import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCirclePortfolio } from "@/lib/services/portfolio.service"
import { getOpportunityDashboardSnapshot } from "@/lib/services/opportunity.service"
import { PortfolioDashboard, PortfolioErrorState } from "@/components/portfolio/portfolio-dashboard"
import { OpportunitySnapshotStrip } from "@/components/portfolio/opportunity-snapshot"
import { CURRENCIES } from "@/lib/constants"

export default async function InvestmentPortfolioPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle
  try {
    circle = await getCircleById(circleId, session.user.id)
  } catch {
    notFound()
  }

  let portfolio
  let snapshot: Awaited<ReturnType<typeof getOpportunityDashboardSnapshot>> | null = null
  try {
    ;[portfolio, snapshot] = await Promise.all([
      getCirclePortfolio(circleId, session.user.id, circle.currency),
      getOpportunityDashboardSnapshot(circleId, session.user.id).catch(() => null),
    ])
  } catch (e) {
    return <PortfolioErrorState message={(e as Error).message} />
  }

  const symbol = CURRENCIES.find((c) => c.code === circle.currency)?.symbol || circle.currency || "R"

  return (
    <>
      {snapshot && <OpportunitySnapshotStrip circleId={circleId} snapshot={snapshot} symbol={symbol} />}
      <PortfolioDashboard circleId={circleId} circleName={circle.name} currency={circle.currency} data={portfolio} />
    </>
  )
}