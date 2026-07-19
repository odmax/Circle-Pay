import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCircleById } from "@/lib/services/circle.service"
import { getWorkflows } from "@/lib/services/approval-workflow.service"
import { WorkflowListManager } from "@/components/approvals/workflow-list-manager"

export default async function WorkflowsPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  const circle = await getCircleById(circleId, session.user.id).catch(() => null)
  if (!circle) notFound()

  const workflows = await getWorkflows(circleId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}/manage/approvals`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Approval Workflows</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
        <Button render={<Link href={`/circles/${circleId}/manage/approvals/workflows/new`}>Create Workflow</Link>} className="rounded-xl">
          Create Workflow
        </Button>
      </div>

      <WorkflowListManager
        circleId={circleId}
        initialWorkflows={workflows.map((w) => ({
          ...w,
          minimumAmount: w.minimumAmount != null ? Number(w.minimumAmount) : null,
          maximumAmount: w.maximumAmount != null ? Number(w.maximumAmount) : null,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
          archivedAt: w.archivedAt?.toISOString() ?? null,
          stages: w.stages.map((s) => ({
            ...s,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
          })),
          createdBy: w.createdBy,
          _count: w._count,
        }))}
        actorUserId={session.user.id}
      />
    </div>
  )
}
