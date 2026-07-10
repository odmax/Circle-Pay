import Link from "next/link"
import { createElement } from "react"
import { Users, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CircleTypeBadge, getCircleIcon, getCircleColor } from "./circle-type-badge"
import { RoleBadge } from "./role-badge"
import type { CircleWithRole } from "@/types"
import { CURRENCIES } from "@/lib/constants"

export function CircleCard({ circle }: { circle: CircleWithRole }) {
  const IconType = getCircleIcon(circle.type)
  const currency = CURRENCIES.find((c) => c.code === circle.currency)
  const symbol = currency?.symbol ?? circle.currency

  return (
    <Link href={`/circles/${circle.id}`}>
      <Card className="group rounded-2xl border-border/40 transition-all hover:border-brand-200 hover:shadow-sm">
        <CardContent className="flex items-center gap-4 p-5">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${getCircleColor(circle.type)}`}
          >
            {createElement(IconType, { className: "size-5" })}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{circle.name}</h3>
              <CircleTypeBadge type={circle.type} />
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {circle.memberCount} member{circle.memberCount !== 1 ? "s" : ""}
              </span>
              <span>{symbol} {circle.currency}</span>
              <RoleBadge role={circle.role} />
            </div>
          </div>

          <ChevronRight className="size-5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </Link>
  )
}
