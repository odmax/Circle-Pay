import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleInsights } from "@/lib/services/ai-insight.service"
import { hasFeature, getCurrentPlanSlug } from "@/lib/services/feature-gate.service"
import { UpgradeCTA } from "@/components/owner/upgrade-cta"

const severityColors: Record<string, string> = {
  INFO: "border-blue-200 bg-blue-50 text-blue-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
}

export default async function InsightsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle
  try { circle = await getCircleById(circleId, session.user.id) } catch { notFound() }

  if (!await hasFeature(session.user.id, "AI_ASSISTANT")) return <UpgradeCTA planName={await getCurrentPlanSlug(session.user.id)} />

  let insights: any[] = []
  try { insights = await getCircleInsights(circleId, session.user.id) } catch {}

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      {insights.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lightbulb className="mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No insights yet</p>
            <p className="text-xs text-muted-foreground">Insights will appear as your circle becomes more active</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.map((i) => (
            <Card key={i.id} className={`rounded-2xl ${i.isRead ? "border-border/40" : "border-brand-200 bg-brand-50/10"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant="outline" className={`text-xs border ${severityColors[i.severity]}`}>{i.severity}</Badge>
                  {!i.isRead && <div className="size-2 rounded-full bg-brand shrink-0 mt-1" />}
                </div>
                <h4 className="font-semibold text-sm">{i.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{i.content}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{new Date(i.createdAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
