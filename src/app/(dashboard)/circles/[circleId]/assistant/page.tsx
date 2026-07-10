import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Sparkles, TrendingUp, AlertTriangle, CheckCircle, Info, PiggyBank } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleInsights } from "@/lib/services/ai-insight.service"
import { hasFeature, getCurrentPlanSlug } from "@/lib/services/feature-gate.service"
import { UpgradeCTA } from "@/components/owner/upgrade-cta"
import { CURRENCIES } from "@/lib/constants"

const severityIcons: Record<string, React.ElementType> = { SUCCESS: CheckCircle, WARNING: AlertTriangle, INFO: Info, CRITICAL: AlertTriangle }
const severityColors: Record<string, string> = { SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-700", WARNING: "border-amber-200 bg-amber-50 text-amber-700", INFO: "border-blue-200 bg-blue-50 text-blue-700", CRITICAL: "border-red-200 bg-red-50 text-red-700" }

export default async function AssistantPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle, insights: any[] = []
  try { [circle, insights] = await Promise.all([getCircleById(circleId, session.user.id), getCircleInsights(circleId, session.user.id)]) }
  catch { notFound() }

  if (!await hasFeature(session.user.id, "AI_ASSISTANT")) return <UpgradeCTA planName={await getCurrentPlanSlug(session.user.id)} />

  const health = insights.length > 0 ? Math.min(100, 30 + insights.length * 10) : 30

  const ccy = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = ccy?.symbol ?? circle.currency

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Assistant</h1><p className="text-muted-foreground">{circle.name}</p></div>
      </div>

      {/* Health Score */}
      <Card className="rounded-2xl border-brand-200 bg-brand-50/20">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={`flex size-14 items-center justify-center rounded-2xl ${health >= 70 ? "bg-emerald-100 text-emerald-600" : health >= 40 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
            <span className="text-2xl font-bold">{health}</span>
          </div>
          <div>
            <p className="font-bold text-lg">Circle Health Score</p>
            <p className="text-sm text-muted-foreground">{health >= 70 ? "Your circle is on track" : health >= 40 ? "Some areas need attention" : "Your circle needs attention"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      {insights.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><Sparkles className="size-10 text-muted-foreground/50 mb-3" /><p className="font-medium">No insights yet</p><p className="text-sm text-muted-foreground">Start adding contributions, goals, and expenses to generate insights</p></CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {insights.map((insight: any, i: number) => {
            const Icon = severityIcons[insight.severity] || Info
            return (
              <Card key={i} className={`rounded-2xl ${severityColors[insight.severity].replace("text-", "border-").split(" ")[0]}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`size-5 mt-0.5 ${severityColors[insight.severity].split(" ")[1]}`} />
                    <div>
                      <Badge variant="outline" className={`text-[10px] mb-1 ${severityColors[insight.severity]}`}>{insight.severity}</Badge>
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{insight.content}</p>
                      {insight.action && (
                        <Button render={<Link href={`/circles/${circleId}/${insight.action.toLowerCase().replace(/ /g, "-")}`} />} variant="outline" size="sm" className="mt-2 rounded-xl text-xs">{insight.action}</Button>
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
