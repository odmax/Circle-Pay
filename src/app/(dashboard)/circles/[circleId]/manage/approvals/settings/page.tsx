import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCircleById } from "@/lib/services/circle.service"
import { getApprovalConfig } from "@/lib/services/approval.service"
import { ApprovalSettingsForm } from "@/components/approvals/approval-settings-form"

export default async function ApprovalSettingsPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  const circle = await getCircleById(circleId, session.user.id).catch(() => null)
  if (!circle) notFound()

  const approvalConfig = await getApprovalConfig(circleId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          render={<Link href={`/circles/${circleId}/manage/approvals`} />}
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Approval Settings</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <div className="mx-auto max-w-lg">
        <ApprovalSettingsForm circleId={circleId} initialConfig={approvalConfig} />
      </div>
    </div>
  )
}
