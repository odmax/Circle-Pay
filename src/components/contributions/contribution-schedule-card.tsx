"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Coins, Loader2, Trash2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

interface ScheduleCardProps {
  circleId: string
  schedule: {
    id: string
    name: string
    amount: number
    frequency: string
    firstDueDate: Date | string
    dueDay: number | null
    gracePeriodDays: number
    lateFee: number | null
    isActive: boolean
    autoGenerate: boolean
    nextDueDate: Date | string | null
    _count?: { contributions: number }
  }
  currencySymbol: string
  canManage: boolean
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUALLY: "Annually",
  CUSTOM: "Custom",
}

export function ContributionScheduleCard({ circleId, schedule, currencySymbol, canManage }: ScheduleCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleDelete() {
    if (!confirm("Delete this schedule? Upcoming and due contributions will be cancelled.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/contribution-schedules/${schedule.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to delete schedule")
        return
      }
      toast.success("Schedule deleted")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggleActive() {
    setToggling(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/contribution-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !schedule.isActive }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to update schedule")
        return
      }
      toast.success(schedule.isActive ? "Schedule paused" : "Schedule activated")
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setToggling(false)
    }
  }

  return (
    <Card className={`rounded-2xl border-border/40 ${schedule.isActive ? "" : "opacity-60"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold truncate">{schedule.name}</h4>
            <p className="text-[10px] text-muted-foreground">
              {FREQ_LABELS[schedule.frequency] ?? schedule.frequency}
              {schedule.dueDay ? ` · Day ${schedule.dueDay}` : ""}
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${schedule.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            {schedule.isActive ? "Active" : "Paused"}
          </Badge>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold">
            {currencySymbol}{schedule.amount.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">/ period</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            Next: {schedule.nextDueDate ? new Date(schedule.nextDueDate).toLocaleDateString() : "—"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            {schedule._count?.contributions ?? 0} records
          </span>
          <span className="flex items-center gap-1.5">
            <Coins className="size-3.5" />
            Grace: {schedule.gracePeriodDays}d
          </span>
          {schedule.lateFee != null && schedule.lateFee > 0 && (
            <span className="flex items-center gap-1.5 text-red-600">
              Fee: {currencySymbol}{schedule.lateFee}
            </span>
          )}
        </div>

        {canManage && (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs flex-1" onClick={handleToggleActive} disabled={toggling}>
              {toggling ? <Loader2 className="size-3 animate-spin" /> : schedule.isActive ? "Pause" : "Activate"}
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs text-destructive/70 hover:text-destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
