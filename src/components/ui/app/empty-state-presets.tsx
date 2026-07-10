"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle, Users, PiggyBank, Target, FileText, Wallet, MessageSquare, Calendar, BarChart3, Bell, Search, Shield, Globe, ShoppingBag, Megaphone, DollarSign, Send, Gift } from "lucide-react"

interface EmptyPresetProps {
  title?: string
  description?: string
  onPrimary?: () => void
  onClear?: () => void
  label?: string
}

function EmptyWrapper({ icon: Icon, title, description, primaryLabel, primaryHref, primaryAction, secondaryLabel, secondaryHref }: {
  icon: React.ComponentType<{ className?: string }>
  title: string; description: string
  primaryLabel?: string; primaryHref?: string; primaryAction?: () => void
  secondaryLabel?: string; secondaryHref?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <Icon className="size-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      <div className="flex gap-2 mt-4">
        {primaryLabel && (primaryHref ? (
          <Button render={<Link href={primaryHref} />} className="rounded-xl bg-brand hover:bg-brand-600">{primaryLabel}</Button>
        ) : primaryAction ? (
          <Button onClick={primaryAction} className="rounded-xl bg-brand hover:bg-brand-600">{primaryLabel}</Button>
        ) : null)}
        {secondaryLabel && secondaryHref && (
          <Button render={<Link href={secondaryHref} />} variant="outline" className="rounded-xl">{secondaryLabel}</Button>
        )}
      </div>
    </div>
  )
}

export function NoCirclesEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <Globe className="size-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-semibold">Start your first Circle</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">Circles are group savings communities. Choose a type that matches your group's needs.</p>
      <div className="grid gap-2 mt-4 w-full max-w-xs">
        {[{ label: "Stokvel", desc: "Traditional rotating savings", type: "STOKVEL" }, { label: "Savings", desc: "Group goal-based saving", type: "SAVINGS" }, { label: "Housemate", desc: "Shared living expenses", type: "HOUSEMATE" }, { label: "Travel", desc: "Group travel fund", type: "TRAVEL" }].map((t) => (
          <Link key={t.type} href={`/circles/new?type=${t.type}`} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:bg-muted transition-colors">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">{t.label[0]}</div>
            <div><p className="text-sm font-medium">{t.label}</p><p className="text-xs text-muted-foreground">{t.desc}</p></div>
          </Link>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <Button render={<Link href="/circles/new" />} className="rounded-xl bg-brand hover:bg-brand-600"><PlusCircle className="size-4 mr-1" /> Create Circle</Button>
        <Button render={<Link href="/discover" />} variant="outline" className="rounded-xl"><Search className="size-4 mr-1" /> Discover Circles</Button>
      </div>
    </div>
  )
}

export function NoContributionsEmpty() {
  return <EmptyWrapper icon={PiggyBank} title="No contributions yet" description="Start tracking member contributions with a plan, then record payments." primaryLabel="Create Plan" primaryHref="#" secondaryLabel="Learn more" secondaryHref="#" />
}

export function NoExpensesEmpty() {
  return <EmptyWrapper icon={ShoppingBag} title="No expenses yet" description="Track group spending by recording expenses and splitting them between members." primaryLabel="Add Expense" primaryHref="#" />
}

export function NoGoalsEmpty() {
  return <EmptyWrapper icon={Target} title="Give your circle a target" description="Goals help your group focus. Set a target amount and deadline, then track progress." primaryLabel="Create Goal" primaryHref="#" />
}

export function NoMembersEmpty() {
  return <EmptyWrapper icon={Users} title="Invite members" description="Share your circle's invite link or add members by email to get started together." primaryLabel="Invite Members" primaryHref="#" />
}

export function NoReportsEmpty() {
  return <EmptyWrapper icon={FileText} title="Reports coming soon" description="Contribution summaries, expense breakdowns, and balance sheets will appear here as your circle grows." primaryLabel="Add Contribution" primaryHref="#" />
}

export function NoWalletActivityEmpty() {
  return <EmptyWrapper icon={Wallet} title="No wallet activity" description="Track deposits, withdrawals, and transfers. Wallet tracking becomes available on Premium and Community plans." primaryLabel="Upgrade Plan" primaryHref="/upgrade" />
}

export function NoFeedPostsEmpty() {
  return <EmptyWrapper icon={MessageSquare} title="Your community starts here" description="Share updates, announcements, or just say hello to your circle members." primaryLabel="Post Update" primaryHref="#" />
}

export function NoEventsEmpty() {
  return <EmptyWrapper icon={Calendar} title="No upcoming events" description="Schedule meetings, deadlines, or social events for your circle." primaryLabel="Create Event" primaryHref="#" />
}

export function NoPollsEmpty() {
  return <EmptyWrapper icon={BarChart3} title="No polls yet" description="Create a poll to let members vote on decisions. Majority wins or require unanimity." primaryLabel="Create Poll" primaryHref="#" />
}

export function NoNotificationsEmpty() {
  return <EmptyWrapper icon={Bell} title="No notifications" description="You'll see contribution reminders, approvals, and circle activity here." />
}

export function NoSupportTicketsEmpty() {
  return <EmptyWrapper icon={Send} title="No support tickets" description="Need help? Submit a ticket and our team will respond." primaryLabel="Submit Ticket" primaryHref="/support" />
}

export function NoSearchResults({ onClear }: EmptyPresetProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Search className="size-10 text-muted-foreground/30 mb-3" />
      <p className="text-sm font-medium">No results found</p>
      <p className="text-xs text-muted-foreground mt-1">Try changing your filters or search term.</p>
      {onClear && <Button variant="outline" size="sm" className="rounded-xl mt-3 text-xs" onClick={onClear}>Clear Filters</Button>}
    </div>
  )
}

export function NoOwnerDataEmpty({ label }: { label?: string }) {
  return <EmptyWrapper icon={Shield} title={`No ${label || "data"} yet`} description={`${label || "Records"} will appear here as the platform grows.`} />
}

export function NoFraudSignalsEmpty() {
  return <EmptyWrapper icon={Shield} title="No risk signals" description="All clear. Suspicious activity and risk signals will appear here if detected." />
}

export function NoBroadcastsEmpty() {
  return <EmptyWrapper icon={Megaphone} title="No broadcasts sent" description="Send announcements to all users or specific groups." primaryLabel="Create Broadcast" primaryHref="#" />
}

export function NoPromotionsEmpty() {
  return <EmptyWrapper icon={Gift} title="No promo codes" description="Create discount codes for launch offers, seasonal campaigns, or referral rewards." primaryLabel="Create Promo" primaryHref="#" />
}

export function NoPlansEmpty() {
  return <EmptyWrapper icon={DollarSign} title="No plans configured" description="Create subscription plans with features, pricing, and limits." primaryLabel="Create Plan" primaryHref="#" />
}

export function DashboardOnboardingChecklist() {
  const steps = [
    { label: "Create or join a circle", done: false },
    { label: "Invite members to your circle", done: false },
    { label: "Set up contributions or expenses", done: false },
    { label: "Create your first goal", done: false },
  ]
  return (
    <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-6 space-y-4">
      <h3 className="font-semibold text-lg">Getting Started</h3>
      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-xs font-bold text-muted-foreground">{i + 1}</div>
            <span className="text-sm">{s.label}</span>
          </div>
        ))}
      </div>
      <Button render={<Link href="/circles/new" />} className="rounded-xl bg-brand hover:bg-brand-600 w-full"><PlusCircle className="size-4 mr-1" /> Start Your First Circle</Button>
    </div>
  )
}
