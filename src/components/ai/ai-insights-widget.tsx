"use client"

import { useState } from "react"
import {
  Heart, AlertTriangle, TrendingUp, PiggyBank, Lightbulb, RefreshCw,
  CheckCircle, Archive, XCircle, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CURRENCIES } from "@/lib/constants"

const severityColors: Record<string, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  INFO: "border-blue-200 bg-blue-50 text-blue-700",
  SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-700",
}
const severityIcons: Record<string, React.ElementType> = {
  CRITICAL: AlertTriangle, WARNING: AlertTriangle, INFO: TrendingUp, SUCCESS: CheckCircle,
}
const ratingColors: Record<string, string> = {
  EXCELLENT: "bg-emerald-100 text-emerald-600",
  GOOD: "bg-blue-100 text-blue-600",
  AVERAGE: "bg-amber-100 text-amber-600",
  NEEDS_ATTENTION: "bg-orange-100 text-orange-600",
  CRITICAL: "bg-red-100 text-red-600",
}

export function AiInsightsWidget({
  circleId,
  circleName,
  currency,
  initialHealth,
  initialInsights,
}: {
  circleId: string
  circleName: string
  currency: string
  initialHealth: { score: number; rating: string; factors: Array<{ name: string; score: number; weight: number; details: string }> } | null
  initialInsights: Array<{ id: string; type: string; title: string; content: string; severity: string; category: string; status: string; reason: string | null; recommendedAction: string | null; createdAt: string }>
}) {
  const [health, setHealth] = useState(initialHealth)
  const [insights, setInsights] = useState(initialInsights)
  const [loading, setLoading] = useState(false)

  const ccy = CURRENCIES.find((c) => c.code === currency)
  const symbol = ccy?.symbol ?? currency

  async function handleRegenerate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/ai`, { method: "POST" })
      const data = await res.json()
      if (data.healthScore !== undefined) {
        setHealth({ score: data.healthScore, rating: data.rating, factors: [] })
      }
      const fresh = await fetch(`/api/circles/${circleId}/ai`)
      const freshData = await fresh.json()
      setInsights(freshData.insights || [])
    } catch {
      // silent
    }
    setLoading(false)
  }

  async function handleStatusChange(insightId: string, status: string) {
    await fetch(`/api/circles/${circleId}/ai/insights/${insightId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setInsights((prev) =>
      prev.map((i) => (i.id === insightId ? { ...i, status } : i))
    )
  }

  const risks = insights.filter((i) => i.severity === "CRITICAL" || i.severity === "WARNING")
  const opportunities = insights.filter((i) => i.category === "OPPORTUNITY" || i.severity === "SUCCESS")
  const activeInsights = insights.filter((i) => i.status === "ACTIVE" || i.status === "READ")

  return (
    <Card className="rounded-2xl border-brand-200 bg-brand-50/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="size-4" /> AI Financial Insights
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={handleRegenerate}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {loading ? "Analyzing..." : "Regenerate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score */}
        {health && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-background/50">
            <div className={`flex size-12 items-center justify-center rounded-xl ${ratingColors[health.rating]}`}>
              <span className="text-xl font-bold">{health.score}</span>
            </div>
            <div>
              <p className="font-bold">Circle Health Score</p>
              <p className="text-sm text-muted-foreground">{health.rating.replace("_", " ")}</p>
            </div>
          </div>
        )}

        {/* Predicted Cash Position */}
        <div className="flex items-center gap-2 text-sm">
          <PiggyBank className="size-4 text-muted-foreground" />
          <span className="font-medium">Predicted Cash Position</span>
          <span className="text-muted-foreground ml-auto">
            {health?.factors?.find((f) => f.name === "Financial Stability")?.details || "Calculating..."}
          </span>
        </div>

        {/* Top Risks */}
        {risks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Top Risks</p>
            <div className="space-y-2">
              {risks.slice(0, 3).map((ins) => {
                const Icon = severityIcons[ins.severity] || AlertTriangle
                return (
                  <div key={ins.id} className={`rounded-xl border p-2.5 ${severityColors[ins.severity]}`}>
                    <div className="flex items-start gap-2">
                      <Icon className="size-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{ins.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{ins.content}</p>
                        {ins.recommendedAction && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">Action: {ins.recommendedAction}</p>
                        )}
                        <div className="flex gap-1 mt-1.5">
                          {ins.status === "ACTIVE" && (
                            <>
                              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={() => handleStatusChange(ins.id, "READ")}>Mark Read</Button>
                              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={() => handleStatusChange(ins.id, "ARCHIVED")}>Archive</Button>
                            </>
                          )}
                          {ins.status === "RESOLVED" && <Badge variant="outline" className="text-[10px]">Resolved</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top Opportunities */}
        {opportunities.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Top Opportunities</p>
            <div className="space-y-2">
              {opportunities.slice(0, 2).map((ins) => {
                const Icon = severityIcons[ins.severity] || CheckCircle
                return (
                  <div key={ins.id} className={`rounded-xl border p-2.5 ${severityColors[ins.severity]}`}>
                    <div className="flex items-start gap-2">
                      <Icon className="size-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{ins.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{ins.content}</p>
                        {ins.recommendedAction && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">Action: {ins.recommendedAction}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {activeInsights.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Lightbulb className="size-3" /> Recommended Actions
            </p>
            <div className="space-y-1">
              {activeInsights
                .filter((i) => i.recommendedAction)
                .slice(0, 3)
                .map((ins) => (
                  <div key={ins.id} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                    <span>{ins.recommendedAction}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeInsights.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No insights yet. Click Regenerate to analyze.</p>
        )}
      </CardContent>
    </Card>
  )
}