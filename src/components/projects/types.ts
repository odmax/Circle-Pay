import { CURRENCIES } from "@/lib/constants"

export function formatCurrency(amount: number, currencyCode?: string): string {
  const symbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol || "R"
  return `${symbol}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100) / 100}%`
}

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  FUNDING_SETUP: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400",
  FUNDING_OPEN: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  PARTIALLY_FUNDED: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400",
  FULLY_FUNDED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  ACTIVE: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400",
  REVENUE_GENERATING: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  SUSPENDED: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  CANCELLED: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  FAILED: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
}

export const ROUND_STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSING: "border-amber-200 bg-amber-50 text-amber-700",
  CLOSED: "border-slate-200 bg-slate-50 text-slate-600",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
}

export const CAPITAL_TX_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-slate-200 bg-slate-50 text-slate-600",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
}

export const CAPITAL_CLASSIFICATION_LABELS: Record<string, string> = {
  REQUIRED_EQUITY: "Required Equity",
  EXTRA_EQUITY: "Extra Equity",
  SHORTFALL_COVER_EQUITY: "Shortfall Cover",
  MEMBER_ADVANCE: "Member Advance",
  EXTERNAL_INVESTMENT: "External Investment",
  LOAN: "Loan",
  DONATION: "Donation",
  SPONSORSHIP: "Sponsorship",
}

export const EXPENSE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PAID: "border-blue-200 bg-blue-50 text-blue-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-slate-200 bg-slate-50 text-slate-500",
  VOIDED: "border-red-200 bg-red-50 text-red-600",
  CORRECTED: "border-purple-200 bg-purple-50 text-purple-700",
}

export const EXPENSE_CATEGORIES = [
  "LEGAL", "LABOUR", "MATERIALS", "TRANSPORT", "ADMIN",
  "MARKETING", "PROFESSIONAL_FEES", "EQUIPMENT", "RENT", "UTILITIES", "OTHER",
]

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  LEGAL: "Legal",
  LABOUR: "Labour",
  MATERIALS: "Materials",
  TRANSPORT: "Transport",
  ADMIN: "Administration",
  MARKETING: "Marketing",
  PROFESSIONAL_FEES: "Professional Fees",
  EQUIPMENT: "Equipment",
  RENT: "Rent",
  UTILITIES: "Utilities",
  OTHER: "Other",
}

export const BUDGET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NEAR_LIMIT: "border-amber-200 bg-amber-50 text-amber-700",
  OVER_BUDGET: "border-red-200 bg-red-50 text-red-700",
}

export const OVER_BUDGET_POLICIES = [
  { value: "WARN", label: "Warn", desc: "Show warning but allow" },
  { value: "APPROVE", label: "Require Approval", desc: "Require approval for over-budget" },
  { value: "BLOCK", label: "Block", desc: "Block over-budget expenses" },
]

export interface BudgetCategoryData {
  id: string
  projectId: string
  category: string
  description?: string | null
  approvedBudget: string | number
  committedCost: string | number
  actualCost: string | number
  remainingBudget: string | number
  variance: string | number
  status: string
  overBudgetPolicy: string
  createdAt: string
  updatedAt: string
}

export interface VendorData {
  id: string
  projectId: string
  circleId: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  taxNumber?: string | null
  paymentDetails?: string | null
  totalSpend: string | number
  expenseCount: number
  isActive: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseData {
  id: string
  projectId: string
  circleId: string
  createdById: string
  approvedById?: string | null
  paidById?: string | null
  vendorId?: string | null
  correctedFromId?: string | null
  voidedById?: string | null
  title: string
  description?: string | null
  category: string
  amount: string | number
  currency: string
  status: string
  paymentMethod?: string | null
  expenseDate?: string | null
  approvedAt?: string | null
  paidAt?: string | null
  rejectedAt?: string | null
  rejectedReason?: string | null
  voidedAt?: string | null
  voidReason?: string | null
  receiptUrl?: string | null
  vendorName?: string | null
  vendorContact?: string | null
  reference?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: { id: string; name?: string | null; email?: string | null }
  approvedBy?: { id: string; name?: string | null }
  paidBy?: { id: string; name?: string | null }
  voidedBy?: { id: string; name?: string | null }
  vendor?: VendorData | null
  project?: { id: string; name: string; circleId: string }
}

export interface ExpenseDashboardData {
  expenses: ExpenseData[]
  summary: {
    raised: number
    totalApproved: number
    totalPaid: number
    totalPending: number
    totalDrafts: number
    remainingBudget: number
    spendPercentage: number
    categoryBreakdown: Record<string, number>
    budgetByCategory: Record<string, { budgeted: number; spent: number; variance: number }>
  }
  warnings: string[]
}

export interface BudgetDashboardData {
  categories: BudgetCategoryData[]
  summary: {
    totalApprovedBudget: number
    totalCommitted: number
    totalSpent: number
    totalRemaining: number
    totalVariance: number
    burnPercent: number
    overBudgetCount: number
    pendingApprovalCount: number
  }
  largestCategories: Array<{ category: string; approved: number; spent: number; percent: number }>
  warnings: string[]
}

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  LEGAL: "bg-blue-100 text-blue-700",
  LABOUR: "bg-orange-100 text-orange-700",
  MATERIALS: "bg-amber-100 text-amber-700",
  TRANSPORT: "bg-purple-100 text-purple-700",
  ADMIN: "bg-slate-100 text-slate-700",
  MARKETING: "bg-pink-100 text-pink-700",
  PROFESSIONAL_FEES: "bg-indigo-100 text-indigo-700",
  EQUIPMENT: "bg-cyan-100 text-cyan-700",
  RENT: "bg-teal-100 text-teal-700",
  UTILITIES: "bg-lime-100 text-lime-700",
  OPERATIONS: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-gray-100 text-gray-700",
}

export interface ProjectData {
  id: string
  name: string
  slug: string
  description?: string | null
  status: string
  type: string
  visibility: string
  targetAmount?: string | number | null
  currentAmount: string | number
  startDate?: string | null
  targetCompletionDate?: string | null
  completedAt?: string | null
  coverImage?: string | null
  color?: string | null
  settings?: any
  createdAt: string
  updatedAt: string
  circleId: string
  createdById: string
  activities?: ActivityData[]
}

export interface CircleData {
  id: string
  name: string
  currency: string
  userRole: string
}

export interface FundingRoundData {
  id: string
  name: string
  description?: string | null
  targetAmount: string | number
  currentAmount: string | number
  allocationMethod: string
  status: string
  opensAt?: string | null
  closesAt?: string | null
  minimumContribution?: string | number | null
  maximumContribution?: string | number | null
  allowOverfunding: boolean
  overfundingTreatment?: string | null
  createdBy?: { name?: string | null }
  createdAt: string
}

export interface ContributionData {
  id: string
  userId: string
  amount: string | number
  reference?: string | null
  status: string
  proofUrl?: string | null
  confirmedAt?: string | null
  createdAt: string
  user?: { id: string; name?: string | null; email?: string | null }
}

export interface CapitalTransactionData {
  id: string
  participantId: string
  fundingRoundId?: string | null
  amount: string | number
  classification: string
  ownershipEligibleAmount: string | number
  repaymentEligibleAmount: string | number
  profitEligibleAmount: string | number
  status: string
  reference?: string | null
  createdAt: string
  participant?: {
    id: string
    userId?: string | null
    user?: { id: string; name?: string | null } | null
    externalName?: string | null
    externalEmail?: string | null
    type: string
  }
}

export interface AllocationData {
  id: string
  fundingRoundId: string
  participantId: string
  allocatedAmount: string | number
  committedAmount: string | number
  paidAmount: string | number
  shortfallAmount: string | number
  excessAmount: string | number
  status: string
  participant?: {
    id: string
    user?: { id: string; name?: string | null } | null
    externalName?: string | null
    type: string
  }
}

export interface ShortfallData {
  id: string
  allocationId: string
  amount: string | number
  type: string
  status: string
  coveringParticipantId?: string | null
  coveredParticipantId?: string | null
  createdAt: string
  coveringParticipant?: { id: string; user?: { name?: string | null } | null; externalName?: string | null }
  coveredParticipant?: { id: string; user?: { name?: string | null } | null; externalName?: string | null }
}

export interface ActivityData {
  id: string
  projectId: string
  userId?: string | null
  type: string
  title: string
  description?: string | null
  metadata?: any
  createdAt: string
}

export interface FundingOverviewData {
  rounds: FundingRoundData[]
  contributions: ContributionData[]
  capitalTransactions: CapitalTransactionData[]
  allocations: AllocationData[]
  summary: {
    raised: number
    totalTarget: number
    pendingCount: number
    totalCommitted: number
    totalPaid: number
    totalShortfall: number
    totalExcess: number
    participantCount: number
  }
}
