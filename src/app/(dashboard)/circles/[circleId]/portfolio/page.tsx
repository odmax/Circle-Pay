import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCirclePortfolio } from "@/lib/services/portfolio.service"
import { PortfolioDashboard, PortfolioErrorState } from "@/components/portfolio/portfolio-dashboard"

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
  try {
    portfolio = await getCirclePortfolio(circleId, session.user.id, circle.currency)
  } catch (e) {
    return <PortfolioErrorState message={(e as Error).message} />
  }

  return (
    <PortfolioDashboard circleId={circleId} circleName={circle.name} currency={circle.currency} data={portfolio} />
  )
}