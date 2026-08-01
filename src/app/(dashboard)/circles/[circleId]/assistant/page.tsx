import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Sparkles, TrendingUp, AlertTriangle, CheckCircle, Info, PiggyBank, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleInsightsWithStatus } from "@/lib/services/ai-insight.service"
import { getOrComputeHealth } from "@/lib/services/finance-health.service"
import { hasFeature, getCurrentPlanSlug } from "@/lib/services/feature-gate.service"
import { UpgradeCTA } from "@/components/owner/upgrade-cta"
import { CURRENCIES } from "@/lib/constants"
import { regenerateInsights } from "@/lib/services/ai-insight.service"

const severityColors: Record<string, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  INFO: "border-blue-200 bg-blue-50 text-blue-700",
  SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-700",
}
const severityIcons: Record<string, React.ElementType> = {
  CRITICAL: AlertTriangle, WARNING: AlertTriangle, INFO: Info, SUCCESS: CheckCircle,
}
const ratingColors: Record<string, string> = {
  EXCELLENT: "bg-emerald-100 text-emerald-600",
  GOOD: "bg-blue-100 text-blue-600",
  AVERAGE: "bg-amber-100 text-amber-600",
  NEEDS_ATTENTION: "bg-orange-100 text-orange-600",
  CRITICAL: "bg-red-100 text-red-600",
}

async function handleRegenerate(formData: FormData) {
  "use server"
  const circleId = formData.get("circleId") as string
  const session = await auth()
  if (!session?.user?.id) return
  await regenerateInsights(circleId, session.user.id)
}

export default async function AssistantPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle, insights: any[] = [], health: any = null
  try {
    ;[circle, insights, health] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getCircleInsightsWithStatus(circleId, session.user.id),
      getOrComputeHealth(circleId),
    ])
  } catch { notFound() }

  if (!await hasFeature(session.user.id, "AI_ASSISTANT")) return <UpgradeCTA planName={await getCurrentPlanSlug(session.user.id)} />

  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div className="flex-1"><h1 className="text-2xl font-bold tracking-tight">AI Financial Assistant</h1><p className="text-muted-foreground">{circle.name}</p></div>
        <form action={handleRegenerate}>
          <input type="hidden" name="circleId" value={circleId} />
          <Button variant="outline" size="sm" className="rounded-xl" type="submit">
            <RefreshCw className="size-4 mr-1" /> Regenerate
          </Button>
        </form>
      </div>

      {/* Health Score */}
      {health && (
        <Card className="rounded-2xl border-brand-200 bg-brand-50/20">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex size-14 items-center justify-center rounded-2xl ${ratingColors[health.rating]}`}>
              <span className="text-2xl font-bold">{health.score}</span>
            </div>
            <div>
              <p className="font-bold text-lg">Circle Health Score</p>
              <p className="text-sm text-muted-foreground">{health.rating.replace("_", " ")} — {health.factors?.length} factors analyzed</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Factors */}
      {health?.factors && health.factors.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Health Factors</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {health.factors.map((f: any) => (
                <div key={f.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{f.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${f.score}%` }} />
                    </div>
                    <span className="font-mono text-xs w-8 text-right">{f.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {insights.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><Sparkles className="size-10 text-muted-foreground/50 mb-3" /><p className="font-medium">No insights yet</p><p className="text-sm text-muted-foreground">Click Regenerate to analyze your circle&apos;s financial data</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {insights.map((insight: any) => {
            const Icon = severityIcons[insight.severity] || Info
            return (
              <Card key={insight.id} className={`rounded-2xl ${severityColors[insight.severity].replace("text-", "border-").split(" ")[0]}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`size-5 mt-0.5 ${severityColors[insight.severity].split(" ")[1]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-[10px] ${severityColors[insight.severity]}`}>{insight.severity}</Badge>
                        {insight.category && <Badge variant="secondary" className="text-[10px]">{insight.category}</Badge>}
                      </div>
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{insight.content}</p>
                      {insight.reason && (
                        <p className="text-[10px] text-muted-foreground mt-1"><span className="font-medium">Reason:</span> {insight.reason}</p>
                      )}
                      {insight.recommendedAction && (
                        <p className="text-[10px] text-brand mt-1"><span className="font-medium">Recommended:</span> {insight.recommendedAction}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}