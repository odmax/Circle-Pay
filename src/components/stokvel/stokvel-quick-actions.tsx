"use client"

import Link from "next/link"
import {
  Calendar,
  Vote,
  Target,
  Clock,
  Send,
  FileText,
  Shield,
  Settings,
  ScrollText,
  UsersRound,
  Scale,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface StokvelQuickActionsProps {
  circleId: string
  permissions: {
    canSubmitOwn: boolean
    canManageEvents: boolean
    canManagePolls: boolean
    canManageGoals: boolean
    canManagePayouts: boolean
    canViewReports: boolean
    canViewPermissions: boolean
    canManageSchedule: boolean
    canViewConstitution: boolean
    canViewMeetings?: boolean
    canVote?: boolean
    canManageMeetings?: boolean
  }
}

export function StokvelQuickActions({ circleId, permissions }: StokvelQuickActionsProps) {
  const actions: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; show: boolean }[] = [
    { label: "Submit Contribution", href: `/circles/${circleId}/contributions`, icon: Send, show: permissions.canSubmitOwn },
    { label: "View Payouts", href: `/circles/${circleId}/payouts`, icon: Clock, show: true },
    { label: "Create Event", href: `/circles/${circleId}/events`, icon: Calendar, show: permissions.canManageEvents },
    { label: "Create Poll", href: `/circles/${circleId}/polls`, icon: Vote, show: permissions.canManagePolls },
    { label: "Manage Goals", href: `/circles/${circleId}/goals`, icon: Target, show: permissions.canManageGoals },
    { label: "Schedule", href: `/circles/${circleId}/contributions`, icon: Clock, show: permissions.canManageSchedule },
    { label: "Reports", href: `/circles/${circleId}/reports`, icon: FileText, show: permissions.canViewReports },
    { label: "Permissions", href: `/circles/${circleId}/manage/permissions`, icon: Shield, show: permissions.canViewPermissions },
    { label: "Constitution", href: `/circles/${circleId}/constitution`, icon: ScrollText, show: permissions.canViewConstitution },
    { label: "Meetings", href: `/circles/${circleId}/meetings`, icon: UsersRound, show: !!permissions.canViewMeetings },
    { label: "Votes", href: `/circles/${circleId}/votes`, icon: Scale, show: !!permissions.canVote },
    { label: "Settings", href: `/circles/${circleId}/manage`, icon: Settings, show: permissions.canManagePayouts },
  ]

  const visible = actions.filter((a) => a.show)

  if (visible.length === 0) return null

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {visible.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="rounded-xl"
                render={<Link href={action.href} />}
              >
                <Icon className="size-3.5 mr-1" />
                {action.label}
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
