import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Plus, FolderKanban, TrendingUp, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getProjectsForCircle } from "@/lib/services/project.service"
import { StatCard } from "@/components/ui/app/cards"
import { CURRENCIES } from "@/lib/constants"

export default async function ProjectsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle, projects
  try { [circle, projects] = await Promise.all([getCircleById(circleId, session.user.id), getProjectsForCircle(circleId)]) } catch { notFound() }
  const isAdmin = circle.userRole === "OWNER" || circle.userRole === "ADMIN"
  const symbol = CURRENCIES.find((c) => c.code === circle.currency)?.symbol || "R"
  const active = projects.filter((p: any) => p.status !== "COMPLETED" && p.status !== "ARCHIVED").length
  const completed = projects.filter((p: any) => p.status === "COMPLETED").length

  const statusBadge = (s: string) => ({ DRAFT: "border-slate-200 bg-slate-50 text-slate-600", FUNDING: "border-amber-200 bg-amber-50 text-amber-700", FUNDED: "border-blue-200 bg-blue-50 text-blue-700", IN_PROGRESS: "border-brand-200 bg-brand-50 text-brand-700", COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700" }[s] || "")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Projects</h1><p className="text-muted-foreground">{circle.name} — Manage every initiative inside this circle</p></div>
        {isAdmin && (
          <Button render={<Link href={`/circles/${circleId}/projects/new`} />} className="rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4 mr-1" /> New Project</Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Projects" value={projects.length} />
        <StatCard label="Active" value={active} />
        <StatCard label="Funding" value={projects.filter((p: any) => p.status === "FUNDING").length} />
        <StatCard label="Completed" value={completed} />
      </div>

      {projects.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FolderKanban className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">No projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">Projects help your circle organise investments, fundraising, purchases and other initiatives.</p>
          {isAdmin && <Button render={<Link href={`/circles/${circleId}/projects/new`} />} className="mt-4 rounded-xl bg-brand hover:bg-brand-600"><Plus className="size-4 mr-1" /> Create First Project</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p: any) => {
            const progress = p.targetAmount && Number(p.targetAmount) > 0 ? Math.round((Number(p.currentAmount) / Number(p.targetAmount)) * 100) : 0
            return (
              <Link key={p.id} href={`/circles/${circleId}/projects/${p.id}`} className="block">
                <Card className="rounded-2xl h-full hover:shadow-sm transition-shadow cursor-pointer">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0"><h3 className="font-bold text-lg truncate">{p.name}</h3><p className="text-xs text-muted-foreground mt-0.5">{p.type || "General"}</p></div>
                      <Badge variant="outline" className={`text-[10px] ${statusBadge(p.status)}`}>{p.status.replace(/_/g, " ")}</Badge>
                    </div>
                    {p.targetAmount && (
                      <div>
                        <div className="flex justify-between text-xs mb-1"><span>{symbol}{Number(p.currentAmount).toLocaleString()}</span><span className="text-muted-foreground">{symbol}{Number(p.targetAmount).toLocaleString()}</span></div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${Math.min(progress, 100)}%` }} /></div>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{p.createdBy?.name || "—"}</span>
                      <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
