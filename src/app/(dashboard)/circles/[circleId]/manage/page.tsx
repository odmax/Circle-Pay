import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShieldCheck, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getApprovalConfig } from "@/lib/services/approval.service"
import { ManageCircleForm } from "@/components/circles/manage-circle-form"

export default async function ManageCirclePage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { circleId } = await params

  let circle
  try { circle = await getCircleById(circleId, session.user.id) } catch { notFound() }

  const canManage = circle.userRole === "OWNER" || circle.userRole === "ADMIN"
  if (!canManage) redirect(`/circles/${circleId}`)

  let approvalConfig
  try {
    approvalConfig = await getApprovalConfig(circleId)
  } catch {
    approvalConfig = null
  }

  const enabledTypes = approvalConfig
    ? Object.entries(approvalConfig)
        .filter(([, settings]) => settings?.enabled)
        .map(([key]) => key)
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Circle</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6">
        <ManageCircleForm
          circle={{
            id: circle.id,
            name: circle.name,
            description: circle.description,
            currency: circle.currency,
            type: circle.type,
            settings: (circle as unknown as { settings: Record<string, unknown> | null }).settings || null,
          }}
        />

        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand" />
              <CardTitle className="text-base">Approval Rules</CardTitle>
            </div>
            <CardDescription>
              Configure which actions require approval before execution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enabledTypes.length > 0 ? (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-muted-foreground">Active approval rules:</p>
                <div className="flex flex-wrap gap-1.5">
                  {enabledTypes.map((type) => (
                    <span
                      key={type}
                      className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium"
                    >
                      {type.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-4">
                No approval rules configured yet.
              </p>
            )}
            <Button
              render={<Link href={`/circles/${circleId}/manage/approvals/settings`} />}
              variant="outline"
              size="sm"
              className="rounded-xl"
            >
              Configure Approval Rules
              <ChevronRight className="size-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
