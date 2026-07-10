import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PiggyBank, Target, Clock } from "lucide-react"
import Link from "next/link"

interface ActivityItem {
  type: string
  title: string
  description: string
  amount: number
  date: Date
  circleName: string
  link: string
}

const iconMap: Record<string, React.ElementType> = {
  contribution: PiggyBank,
  allocation: Target,
}

const colorMap: Record<string, string> = {
  contribution: "bg-emerald-50 text-emerald-600",
  allocation: "bg-brand-50 text-brand",
}

export function RecentActivityFeed({
  activities,
  currencySymbol,
}: {
  activities: ActivityItem[]
  currencySymbol: string
}) {
  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground">
              Activity from your circles will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((item, i) => {
              const Icon = iconMap[item.type] || Clock
              const color = colorMap[item.type] || "bg-muted text-muted-foreground"
              return (
                <Link
                  key={i}
                  href={item.link}
                  className="flex items-start gap-3 rounded-xl p-2 -mx-2 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${color}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(item.date).toLocaleDateString()} · {item.circleName}
                    </p>
                  </div>
                  {item.amount > 0 && (
                    <span
                      className={`shrink-0 text-sm font-mono font-semibold ${
                        item.type === "contribution"
                          ? "text-emerald-600"
                          : "text-brand"
                      }`}
                    >
                      +{currencySymbol}
                      {item.amount.toLocaleString()}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
