import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Settings } from "lucide-react"
import { getCircleTypeConfig } from "@/lib/circle-types"
import { CURRENCIES } from "@/lib/constants"
import type { CircleType } from "@/generated/prisma"

const freqLabels: Record<string, string> = { weekly: "Weekly", monthly: "Monthly" }
const payoutLabels: Record<string, string> = { rotation: "Rotation", random: "Random", fixed: "Fixed Order" }
const contribLabels: Record<string, string> = { offering: "Offering", tithe: "Tithe", project: "Project Fund" }
const riskLabels: Record<string, string> = { low: "Low", medium: "Medium", high: "High" }

function formatValue(key: string, value: unknown, fieldType: string, currencySymbol: string): string {
  if (value === undefined || value === null || value === "") return "—"
  if (fieldType === "currency") return `${currencySymbol}${Number(value).toLocaleString()}`
  if (fieldType === "date") return new Date(value as string).toLocaleDateString()
  if (fieldType === "toggle") return value ? "Enabled" : "Disabled"
  if (fieldType === "select") {
    if (key.includes("frequency") || key.includes("Frequency")) return freqLabels[value as string] ?? String(value)
    if (key.includes("payout") || key.includes("Payout")) return payoutLabels[value as string] ?? String(value)
    if (key.includes("contributionType") || key.includes("ContributionType")) return contribLabels[value as string] ?? String(value)
    if (key.includes("risk") || key.includes("Risk")) return riskLabels[value as string] ?? String(value)
    return String(value)
  }
  return String(value)
}

export function CircleSetupDetails({
  type,
  settings,
  currency,
}: {
  type: CircleType | string
  settings: Record<string, unknown> | null
  currency: string
}) {
  const config = getCircleTypeConfig(type)
  const ccy = CURRENCIES.find((c) => c.code === currency)
  const symbol = ccy?.symbol ?? currency
  const hasSettings = settings && Object.keys(settings).length > 0

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="size-4" />
          Circle Setup Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Configured for <span className="font-medium text-foreground">{config.label}</span>
          {config.description && ` — ${config.description}`}
        </p>

        {!hasSettings ? (
          <p className="text-sm text-muted-foreground italic">
            Setup details not configured yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {config.setupFields.map((field) => {
              const rawValue = settings?.[field.key]
              const displayValue = formatValue(field.key, rawValue, field.type, symbol)
              return (
                <div key={field.key} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  {field.type === "toggle" ? (
                    <Badge
                      variant="outline"
                      className={
                        rawValue
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }
                    >
                      {rawValue ? <Check className="size-3 mr-1" /> : <X className="size-3 mr-1" />}
                      {displayValue}
                    </Badge>
                  ) : (
                    <span className="text-sm font-medium">{displayValue}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
