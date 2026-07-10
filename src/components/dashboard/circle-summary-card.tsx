import Link from "next/link"
import { Users, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CircleTypeBadge, getCircleColor } from "@/components/circles/circle-type-badge"
import { RoleBadge } from "@/components/circles/role-badge"
import { createElement } from "react"
import { getCircleIcon } from "@/components/circles/circle-type-badge"
import type { MemberRole } from "@/generated/prisma"

interface CircleSummary {
  id: string
  name: string
  type: string
  currency: string
  memberCount: number
  role: string
  totalContributions: number
  activeGoals: number
}

export function CircleSummaryCard({
  circle,
  currencySymbol,
}: {
  circle: CircleSummary
  currencySymbol: string
}) {
  const IconType = getCircleIcon(circle.type)

  return (
    <Link href={`/circles/${circle.id}`}>
      <Card className="group rounded-2xl border-border/40 transition-all hover:border-brand-200 hover:shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${getCircleColor(circle.type)}`}
            >
              {createElement(IconType, { className: "size-4" })}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm truncate">{circle.name}</h4>
                <CircleTypeBadge type={circle.type} />
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <Users className="size-3" />
                {circle.memberCount}
                <RoleBadge role={circle.role as MemberRole} />
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-600 font-medium">
              {currencySymbol}
              {circle.totalContributions.toLocaleString()} pool
            </span>
            <span className="text-muted-foreground">
              {circle.activeGoals} goal{circle.activeGoals !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
