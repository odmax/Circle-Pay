"use client"

import Link from "next/link"
import { Users } from "lucide-react"
import type { StokvelDashboardData } from "@/lib/services/stokvel-dashboard.service"
import { StokvelAlerts } from "./stokvel-alerts"
import { StokvelMyContribution } from "./stokvel-my-contribution"
import { StokvelGroupPot } from "./stokvel-group-pot"
import { StokvelPayoutQueue } from "./stokvel-payout-queue"
import { StokvelContributionProgress } from "./stokvel-contribution-progress"
import { StokvelQuickActions } from "./stokvel-quick-actions"
import { StokvelEmptyStates } from "./stokvel-empty-states"
import { StokvelConstitution } from "./stokvel-constitution"
import { StokvelGovernance } from "./stokvel-governance"
import { StokvelYearEnd } from "./stokvel-year-end"
import { StokvelLoan } from "./stokvel-loan"

interface StokvelDashboardProps {
  data: StokvelDashboardData
  symbol: string
  userId: string
}

export function StokvelDashboard({ data, symbol, userId }: StokvelDashboardProps) {
  const { my, group, payout, contributionProgress, alerts, permissions } = data
  const hasData = my.contributionStatus !== "NONE" || group.membersPaid > 0 || payout.hasSchedule

  return (
    <div className="space-y-6">
      <StokvelAlerts alerts={alerts} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StokvelMyContribution my={my} symbol={symbol} />
        <StokvelGroupPot group={group} symbol={symbol} />
      </div>

      {permissions.canViewLoans && (
        <StokvelLoan
          circleId={data.circle.id}
          loan={data.loan}
          symbol={symbol}
          canReviewLoans={permissions.canReviewLoans}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <StokvelPayoutQueue payout={payout} symbol={symbol} />
          <StokvelContributionProgress
            members={contributionProgress}
            symbol={symbol}
            canViewAll={permissions.canViewAll}
            userId={userId}
          />
        </div>

        <div className="space-y-4">
          <StokvelQuickActions
            circleId={data.circle.id}
            permissions={permissions}
          />
          <StokvelConstitution circleId={data.circle.id} constitution={data.constitution} />
          <StokvelGovernance
            circleId={data.circle.id}
            governance={data.governance}
            canVote={permissions.canVote}
            canManageMeetings={permissions.canManageMeetings}
          />
          {permissions.canViewYearEnd && (
            <StokvelYearEnd circleId={data.circle.id} yearEnd={data.yearEnd} />
          )}
          <StokvelEmptyStates
            hasSchedule={payout.hasSchedule}
            hasContributions={group.membersPaid > 0}
            hasGoals={!!group.goalProgress}
            hasEvent={!!group.upcomingEvent}
            circleId={data.circle.id}
            canManageSchedule={permissions.canManageSchedule}
            canManageEvents={permissions.canManageEvents}
            canManageGoals={permissions.canManageGoals}
          />
        </div>
      </div>
    </div>
  )
}
