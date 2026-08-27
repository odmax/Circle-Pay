"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Member {
  member: { id: string; name: string; email: string; image: string | null }
  expected: number
  paid: number
  outstanding: number
  status: string
  proofStatus: string | null
}

interface StokvelContributionProgressProps {
  members: Member[]
  symbol: string
  canViewAll: boolean
  userId: string
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PAID: { label: "Paid", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  PARTIAL: { label: "Partial", color: "border-amber-200 bg-amber-50 text-amber-700" },
  UNPAID: { label: "Unpaid", color: "border-red-200 bg-red-50 text-red-700" },
}

const PROOF_BADGE: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: "Verified", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  NEEDS_REVIEW: { label: "Review", color: "border-amber-200 bg-amber-50 text-amber-700" },
  REJECTED: { label: "Rejected", color: "border-red-200 bg-red-50 text-red-700" },
  PENDING: { label: "Pending", color: "border-slate-200 bg-slate-50 text-slate-600" },
}

export function StokvelContributionProgress({
  members,
  symbol,
  canViewAll,
  userId,
}: StokvelContributionProgressProps) {
  const visibleMembers = canViewAll ? members : members.filter((m) => m.member.id === userId)

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base">
          Member Progress ({visibleMembers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {visibleMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium">No contribution data</p>
            <p className="text-xs text-muted-foreground">
              Contribution progress will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="p-3 pl-4">Member</th>
                  <th className="p-3">Expected</th>
                  <th className="p-3">Paid</th>
                  {canViewAll && <th className="p-3">Outstanding</th>}
                  <th className="p-3">Status</th>
                  <th className="p-3 pr-4">Proof</th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((m) => (
                  <tr
                    key={m.member.id}
                    className={`border-b hover:bg-muted/30 ${m.member.id === userId ? "bg-brand-50/20" : ""}`}
                  >
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage src={m.member.image || ""} />
                          <AvatarFallback className="text-[10px]">
                            {m.member.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-xs">{m.member.name}</p>
                          {m.member.id === userId && (
                            <p className="text-[10px] text-brand">You</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {symbol}{m.expected.toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {symbol}{m.paid.toLocaleString()}
                    </td>
                    {canViewAll && (
                      <td className="p-3 font-mono text-xs">
                        {m.outstanding > 0 ? (
                          <span className="text-red-600">{symbol}{m.outstanding.toLocaleString()}</span>
                        ) : (
                          <span className="text-emerald-600">—</span>
                        )}
                      </td>
                    )}
                    <td className="p-3">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[m.status]?.color ?? ""}`}>
                        {STATUS_BADGE[m.status]?.label ?? m.status}
                      </Badge>
                    </td>
                    <td className="p-3 pr-4">
                      {m.proofStatus && PROOF_BADGE[m.proofStatus] ? (
                        <Badge variant="outline" className={`text-[10px] ${PROOF_BADGE[m.proofStatus].color}`}>
                          {PROOF_BADGE[m.proofStatus].label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
