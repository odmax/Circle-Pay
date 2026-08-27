"use client"

import Link from "next/link"
import { Clock, Users, Target, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface StokvelEmptyStatesProps {
  hasSchedule: boolean
  hasContributions: boolean
  hasGoals: boolean
  hasEvent: boolean
  circleId: string
  canManageSchedule: boolean
  canManageEvents: boolean
  canManageGoals: boolean
}

export function StokvelEmptyStates({
  hasSchedule,
  hasContributions,
  hasGoals,
  hasEvent,
  circleId,
  canManageSchedule,
  canManageEvents,
  canManageGoals,
}: StokvelEmptyStatesProps) {
  const emptyStates: { condition: boolean; icon: React.ComponentType<{ className?: string }>; title: string; description: string; actionLabel?: string; actionHref?: string; show: boolean }[] = [
    {
      condition: !hasSchedule,
      icon: Clock,
      title: "No payout schedule",
      description: "Generate a rotation schedule for your stokvel",
      actionLabel: canManageSchedule ? "View Payouts" : undefined,
      actionHref: `/circles/${circleId}/payouts`,
      show: !hasSchedule,
    },
    {
      condition: !hasContributions,
      icon: Users,
      title: "No payments yet",
      description: "Contributions will appear here once members start paying",
      actionLabel: "Submit Contribution",
      actionHref: `/circles/${circleId}/contributions`,
      show: !hasContributions,
    },
    {
      condition: !hasGoals,
      icon: Target,
      title: "No goals set",
      description: "Create a savings goal for your stokvel",
      actionLabel: canManageGoals ? "Create Goal" : undefined,
      actionHref: `/circles/${circleId}/goals`,
      show: !hasGoals && canManageGoals,
    },
    {
      condition: !hasEvent,
      icon: Calendar,
      title: "No upcoming meetings",
      description: "Schedule a meeting for your stokvel group",
      actionLabel: canManageEvents ? "Create Event" : undefined,
      actionHref: `/circles/${circleId}/events`,
      show: !hasEvent && canManageEvents,
    },
  ]

  const visible = emptyStates.filter((e) => e.show)

  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map((state) => {
        const Icon = state.icon
        return (
          <Card key={state.title} className="rounded-2xl border-border/40">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted shrink-0">
                <Icon className="size-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{state.title}</p>
                <p className="text-xs text-muted-foreground">{state.description}</p>
              </div>
              {state.actionLabel && state.actionHref && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl shrink-0"
                  render={<Link href={state.actionHref} />}
                >
                  {state.actionLabel}
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
