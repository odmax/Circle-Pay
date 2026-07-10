import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RoleBadge } from "@/components/circles/role-badge"
import type { MemberRole } from "@/generated/prisma"

interface MemberStat {
  userId: string
  user: { id: string; name: string | null; email: string }
  role: MemberRole
  totalPaid: number
  totalPending: number
}

export function MemberContributionSummary({
  members,
  currencySymbol,
}: {
  members: MemberStat[]
  currencySymbol: string
}) {
  if (members.length === 0) return null

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const initials = m.user.name
          ? m.user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : "??"

        const total = m.totalPaid + m.totalPending

        return (
          <div
            key={m.userId}
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3"
          >
            <Avatar className="size-9">
              <AvatarImage src="" />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {m.user.name || m.user.email}
                </p>
                <RoleBadge role={m.role} />
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-xs">
                <span className="text-emerald-600 font-medium">
                  {currencySymbol}
                  {m.totalPaid.toLocaleString()} paid
                </span>
                {m.totalPending > 0 && (
                  <span className="text-amber-600 font-medium">
                    {currencySymbol}
                    {m.totalPending.toLocaleString()} pending
                  </span>
                )}
                {total === 0 && (
                  <span className="text-muted-foreground">No contributions</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono font-bold">
                {currencySymbol}
                {total.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">total</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
