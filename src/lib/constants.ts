export const APP_NAME = "Circle Pay"
export const APP_DESCRIPTION =
  "Group finance made simple. Save, track expenses, and manage money together with your circles."
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export const CURRENCIES = [
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
] as const

export const EXPENSE_CATEGORIES = [
  "food",
  "transport",
  "utilities",
  "rent",
  "entertainment",
  "shopping",
  "health",
  "education",
  "travel",
  "other",
] as const

export const CIRCLE_TYPES = [
  { value: "FAMILY", label: "Family", icon: "Heart", description: "Manage family finances, allowances, and shared goals" },
  { value: "TRAVEL", label: "Travel Group", icon: "Plane", description: "Split trip costs, accommodation, and activities" },
  { value: "HOUSEMATE", label: "Housemates", icon: "Home", description: "Rent, utilities, groceries, and shared expenses" },
  { value: "WEDDING", label: "Wedding", icon: "Gem", description: "Wedding budget, contributions, and planning" },
  { value: "SAVINGS", label: "Savings Group", icon: "PiggyBank", description: "Group savings towards shared financial goals" },
  { value: "STOKVEL", label: "Stokvel", icon: "Users", description: "Traditional rotating savings and credit group" },
  { value: "CHURCH", label: "Church Group", icon: "Church", description: "Church offerings, projects, and community funds" },
  { value: "INVESTMENT", label: "Investment Club", icon: "TrendingUp", description: "Pool funds for collective investments" },
  { value: "CUSTOM", label: "Custom", icon: "Circle", description: "Create a circle for any purpose" },
] as const

export const ROLE_LABELS = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
} as const
