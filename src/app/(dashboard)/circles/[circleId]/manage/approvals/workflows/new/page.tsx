import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCircleById } from "@/lib/services/circle.service"
import { WorkflowEditor } from "@/components/approvals/workflow-editor"

export default async function NewWorkflowPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  const circle = await getCircleById(circleId, session.user.id).catch(() => null)
  if (!circle) notFound()

  const members = await import("@/lib/prisma").then((m) =>
    m.prisma.circleMember.findMany({
      where: { circleId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { role: "asc" },
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}/manage/approvals/workflows`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Workflow</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <WorkflowEditor
        circleId={circleId}
        initialWorkflow={null}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
        }))}
        actorUserId={session.user.id}
      />
    </div>
  )
}
