import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/app/cards"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getProjectInvestmentSummaries } from "@/lib/services/project-investment.service"
import { ProjectListClient } from "@/components/projects/list/project-list-client"
import { hasCirclePermission } from "@/lib/permissions/circle-permissions"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { formatCurrency } from "@/components/projects/types"

export default async function ProjectsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle
  let projects
  try {
    ;[circle, projects] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getProjectInvestmentSummaries(circleId, session.user.id),
    ])
  } catch {
    notFound()
  }

  const canCreateProject = await hasCirclePermission({ userId: session.user.id, circleId, permission: CIRCLE_PERMISSIONS.PROJECT_CREATE })
  const symbol = circle?.currency || "ZAR"

  const totalRaised = projects.reduce((s, p) => s + p.capitalInvested, 0)
  const myInvestments = projects.filter((p) => p.myCapital > 0 || p.myOwnershipPercent > 0).length
  const active = projects.filter((p) => p.tags.includes("active")).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investment Projects</h1>
          <p className="text-muted-foreground">{circle.name} — a live view of every initiative, your exposure and returns</p>
        </div>
        {canCreateProject && (
          <Button render={<Link href={`/circles/${circleId}/projects/new`} />} className="rounded-xl bg-brand hover:bg-brand-600">
            <Plus className="size-4 mr-1" /> New Project
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Projects" value={projects.length} />
        <StatCard label="Active" value={active} />
        <StatCard label="Capital Invested" value={formatCurrency(totalRaised, symbol)} />
        <StatCard label="My Investments" value={myInvestments} />
      </div>

      {projects.length === 0 ? (
        <ProjectListClient projects={[]} circleId={circleId} currency={symbol} canCreate={canCreateProject} />
      ) : (
        <ProjectListClient projects={projects} circleId={circleId} currency={symbol} canCreate={canCreateProject} />
      )}
    </div>
  )
}