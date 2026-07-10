import type { MemberRole, CircleType } from "@/generated/prisma"

export type CurrencyCode =
  | "NGN"
  | "KES"
  | "GHS"
  | "ZAR"
  | "USD"
  | "EUR"
  | "GBP"

export type ExpenseCategory =
  | "food"
  | "transport"
  | "utilities"
  | "rent"
  | "entertainment"
  | "shopping"
  | "health"
  | "education"
  | "travel"
  | "other"

export interface CircleWithRole {
  id: string
  name: string
  description: string | null
  currency: string
  type: CircleType
  inviteCode: string
  isActive: boolean
  createdAt: Date
  memberCount: number
  role: MemberRole
}

export interface CircleMemberWithUser {
  id: string
  role: MemberRole
  joinedAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

export interface CircleStats {
  memberCount: number
  totalContributions: number
  activeGoals: number
  pendingBalances: number
}
