// Housemate metrics — reuses the generic shared budget/position math.
import {
  computeTravelBudget,
  computeMyTravelPosition,
  formatTripCurrency,
} from "@/lib/services/travel-metrics"

export const computeHouseholdBudget = computeTravelBudget
export const computeMyHouseholdPosition = computeMyTravelPosition
export const formatHouseholdCurrency = formatTripCurrency

export interface RentStatus {
  paid: boolean
  status: "none" | "paid" | "overdue" | "due_soon" | "upcoming"
  days: number
  label: string
}

export function computeRentStatus(input: {
  monthlyRent: number
  paidThisMonth: number
  dueDay: number
  today?: Date
}): RentStatus {
  const today = input.today ?? new Date()
  const rent = Math.max(0, input.monthlyRent)
  if (rent <= 0) return { paid: false, status: "none", days: 0, label: "No rent set" }
  const paid = input.paidThisMonth >= rent
  const due = new Date(today.getFullYear(), today.getMonth(), Math.max(1, Math.min(28, input.dueDay)))
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (paid) return { paid: true, status: "paid", days: diff, label: "Rent paid" }
  if (diff < 0) return { paid: false, status: "overdue", days: Math.abs(diff), label: `Overdue by ${Math.abs(diff)} day(s)` }
  if (diff === 0) return { paid: false, status: "due_soon", days: 0, label: "Due today" }
  if (diff <= 3) return { paid: false, status: "due_soon", days: diff, label: `Due in ${diff} day(s)` }
  return { paid: false, status: "upcoming", days: diff, label: `Due in ${diff} day(s)` }
}

export interface HouseholdAlert {
  id: string
  level: "info" | "warning" | "risk"
  title: string
  description: string
}

export function computeHouseholdAlerts(input: {
  rentStatus: RentStatus
  recentBills: Array<{ id: string; name: string; dueDate: string | null }>
  utilitiesThisMonth: number
  monthlyRent: number
  membersOwing: number
  pendingProof: boolean
}): HouseholdAlert[] {
  const alerts: HouseholdAlert[] = []
  if (input.rentStatus.status === "overdue") alerts.push({ id: "rent-overdue", level: "risk", title: "Rent overdue", description: "This month's rent has not been fully paid." })
  else if (input.rentStatus.status === "due_soon") alerts.push({ id: "rent-due", level: "warning", title: "Rent due soon", description: input.rentStatus.label + "." })
  for (const b of input.recentBills) {
    if (!b.dueDate) continue
    const diff = new Date(b.dueDate).getTime() - Date.now()
    if (diff >= 0 && diff <= 3 * 86400000) alerts.push({ id: `utility-${b.id}`, level: "warning", title: `Utility due: ${b.name}`, description: "A recurring household bill is due soon." })
  }
  if (input.monthlyRent > 0 && input.utilitiesThisMonth > input.monthlyRent) alerts.push({ id: "overspend", level: "warning", title: "Household overspending", description: "Utilities this month exceed the monthly rent." })
  if (input.membersOwing > 0) alerts.push({ id: "owes", level: "warning", title: "Settlement outstanding", description: `${input.membersOwing} member balance(s) are outstanding.` })
  if (input.pendingProof) alerts.push({ id: "proof", level: "warning", title: "Payment proof unverified", description: "Upload proof for your pending rent payment." })
  return alerts
}