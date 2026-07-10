export interface CircleTypeConfig {
  label: string
  description: string
  setupFields: SetupField[]
  tabs: CircleTab[]
  defaultSettings: Record<string, unknown>
}

export interface SetupField {
  key: string
  label: string
  type: "text" | "number" | "date" | "select" | "currency" | "toggle"
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  helperText?: string
}

export interface CircleTab {
  key: string
  label: string
  icon: string
  href: string
  enabled?: boolean
}

const tabs = {
  members: { key: "members", label: "Members", icon: "Users", href: "/members" },
  contributions: { key: "contributions", label: "Contributions", icon: "PiggyBank", href: "/contributions" },
  goals: { key: "goals", label: "Goals", icon: "Target", href: "/goals" },
  expenses: { key: "expenses", label: "Expenses", icon: "Receipt", href: "/expenses" },
  balances: { key: "balances", label: "Balances", icon: "Scale", href: "/balances" },
  activity: { key: "activity", label: "Activity", icon: "Clock", href: "/activity" },
  insights: { key: "insights", label: "Insights", icon: "Lightbulb", href: "/insights" },
  reports: { key: "reports", label: "Reports", icon: "FileText", href: "/reports" },
  wallet: { key: "wallet", label: "Ledger", icon: "Wallet", href: "/wallet" },
  payouts: { key: "payouts", label: "Payouts", icon: "Users", href: "/payouts" },
  feed: { key: "feed", label: "Feed", icon: "MessageCircle", href: "/feed" },
  events: { key: "events", label: "Events", icon: "Calendar", href: "/events" },
  polls: { key: "polls", label: "Polls", icon: "Vote", href: "/polls" },
  assistant: { key: "assistant", label: "Assistant", icon: "Sparkles", href: "/assistant" },
  operations: { key: "operations", label: "Operations", icon: "TrendingUp", href: "/operations" },
  automations: { key: "automations", label: "Automations", icon: "Zap", href: "/automations" },
  payments: { key: "payments", label: "Payments", icon: "DollarSign", href: "/payments" },
  myStatus: { key: "my-status", label: "My Status", icon: "User", href: "/my-status" },
  myStatement: { key: "my-statement", label: "Statement", icon: "FileText", href: "/my-statement" },
  projects: { key: "projects", label: "Projects", icon: "FolderKanban", href: "/projects" },
} as const

export const CIRCLE_TYPE_CONFIGS: Record<string, CircleTypeConfig> = {
  STOKVEL: {
    label: "Stokvel",
    description: "Traditional rotating savings and credit group",
    setupFields: [
      { key: "contributionAmount", label: "Contribution Amount", type: "currency", required: true, placeholder: "500" },
      { key: "contributionFrequency", label: "Contribution Frequency", type: "select", required: true, options: [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }] },
      { key: "duration", label: "Duration (months)", type: "number", placeholder: "12" },
      { key: "startDate", label: "Start Date", type: "date" },
      { key: "payoutMethod", label: "Payout Method", type: "select", options: [{ value: "rotation", label: "Rotation" }, { value: "random", label: "Random" }, { value: "fixed", label: "Fixed Order" }] },
      { key: "payoutOrder", label: "Payout Order", type: "text", placeholder: "Member names in order" },
    ],
    defaultSettings: { contributionFrequency: "monthly", payoutMethod: "rotation" },
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.events, tabs.polls, tabs.assistant, tabs.contributions, tabs.members, tabs.payouts, tabs.balances, tabs.reports, tabs.wallet, tabs.activity, tabs.insights],
  },
  HOUSEMATE: {
    label: "Housemates",
    description: "Rent, utilities, groceries, and shared expenses",
    setupFields: [
      { key: "rentAmount", label: "Rent Amount", type: "currency", placeholder: "8000" },
      { key: "rentDueDay", label: "Rent Due Day", type: "number", placeholder: "1" },
      { key: "utilitiesEnabled", label: "Track Utilities", type: "toggle" },
      { key: "groceriesEnabled", label: "Track Groceries", type: "toggle" },
    ],
    defaultSettings: { utilitiesEnabled: true, groceriesEnabled: true },
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.events, tabs.assistant, tabs.expenses, tabs.contributions, tabs.balances, tabs.members, tabs.activity],
  },
  TRAVEL: {
    label: "Travel Group",
    description: "Split trip costs, accommodation, and activities",
    setupFields: [
      { key: "destination", label: "Destination", type: "text", required: true, placeholder: "Cape Town" },
      { key: "travelStart", label: "Travel Start Date", type: "date" },
      { key: "travelEnd", label: "Travel End Date", type: "date" },
      { key: "budgetPerPerson", label: "Budget Per Person", type: "currency", placeholder: "5000" },
    ],
    defaultSettings: {},
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.events, tabs.assistant, tabs.contributions, tabs.expenses, tabs.balances, tabs.members, tabs.activity],
  },
  WEDDING: {
    label: "Wedding",
    description: "Wedding budget, contributions, and planning",
    setupFields: [
      { key: "weddingDate", label: "Wedding Date", type: "date" },
      { key: "totalBudget", label: "Total Budget", type: "currency", placeholder: "100000" },
      { key: "brideName", label: "Bride Name", type: "text", placeholder: "Jane" },
      { key: "groomName", label: "Groom Name", type: "text", placeholder: "John" },
      { key: "vendorTracking", label: "Enable Vendor Tracking", type: "toggle" },
    ],
    defaultSettings: { vendorTracking: false },
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.events, tabs.assistant, tabs.goals, tabs.contributions, tabs.expenses, tabs.members, tabs.activity],
  },
  SAVINGS: {
    label: "Savings Group",
    description: "Group savings towards shared financial goals",
    setupFields: [
      { key: "targetAmount", label: "Target Amount", type: "currency", placeholder: "50000" },
      { key: "savingAmount", label: "Saving Amount", type: "currency", placeholder: "1000" },
      { key: "savingFrequency", label: "Saving Frequency", type: "select", options: [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }] },
      { key: "duration", label: "Duration (months)", type: "number", placeholder: "12" },
      { key: "goalDeadline", label: "Goal Deadline", type: "date" },
    ],
    defaultSettings: { savingFrequency: "monthly" },
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.assistant, tabs.goals, tabs.contributions, tabs.members, tabs.reports, tabs.wallet, tabs.activity, tabs.insights],
  },
  FAMILY: {
    label: "Family",
    description: "Manage family finances, allowances, and shared goals",
    setupFields: [
      { key: "fundPurpose", label: "Family Fund Purpose", type: "text", placeholder: "Monthly family budget" },
      { key: "contributionAmount", label: "Contribution Amount", type: "currency", placeholder: "2000" },
      { key: "contributionFrequency", label: "Frequency", type: "select", options: [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }] },
      { key: "emergencyFund", label: "Enable Emergency Fund", type: "toggle" },
    ],
    defaultSettings: { contributionFrequency: "monthly", emergencyFund: false },
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.assistant, tabs.contributions, tabs.goals, tabs.expenses, tabs.members, tabs.wallet, tabs.activity],
  },
  CHURCH: {
    label: "Church Group",
    description: "Church offerings, projects, and community funds",
    setupFields: [
      { key: "ministryName", label: "Ministry / Group Name", type: "text", placeholder: "Youth Ministry" },
      { key: "contributionType", label: "Contribution Type", type: "select", options: [{ value: "offering", label: "Offering" }, { value: "tithe", label: "Tithe" }, { value: "project", label: "Project Fund" }] },
      { key: "fundraisingGoal", label: "Fundraising Goal", type: "currency", placeholder: "50000" },
      { key: "projectName", label: "Project Name", type: "text", placeholder: "Building Fund" },
    ],
    defaultSettings: { contributionType: "offering" },
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.events, tabs.assistant, tabs.contributions, tabs.goals, tabs.members, tabs.expenses, tabs.reports, tabs.wallet, tabs.activity],
  },
  INVESTMENT: {
    label: "Investment Club",
    description: "Pool funds for collective investments",
    setupFields: [
      { key: "investmentGoal", label: "Investment Goal", type: "text", placeholder: "Property investment" },
      { key: "monthlyContribution", label: "Monthly Contribution", type: "currency", placeholder: "5000" },
      { key: "riskLevel", label: "Risk Level", type: "select", options: [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }] },
      { key: "targetReturn", label: "Target Return %", type: "number", placeholder: "15" },
    ],
    defaultSettings: { riskLevel: "medium" },
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.assistant, tabs.contributions, tabs.goals, tabs.members, tabs.activity, tabs.reports, tabs.insights],
  },
  CUSTOM: {
    label: "Custom",
    description: "Create a circle for any purpose",
    setupFields: [
      { key: "customPurpose", label: "Purpose", type: "text", placeholder: "Describe your circle's purpose" },
      { key: "enableContributions", label: "Enable Contributions", type: "toggle" },
      { key: "enableExpenses", label: "Enable Expenses", type: "toggle" },
      { key: "enableGoals", label: "Enable Goals", type: "toggle" },
      { key: "enableBalances", label: "Enable Balances", type: "toggle" },
    ],
    defaultSettings: { enableContributions: true, enableExpenses: true, enableGoals: true, enableBalances: true },
    tabs: [tabs.operations, tabs.automations, tabs.payments, tabs.projects, tabs.myStatus, tabs.myStatement, tabs.feed, tabs.assistant, tabs.contributions, tabs.expenses, tabs.goals, tabs.balances, tabs.members, tabs.activity],
  },
}

export function getCircleTypeConfig(type: string): CircleTypeConfig {
  return CIRCLE_TYPE_CONFIGS[type] ?? CIRCLE_TYPE_CONFIGS.CUSTOM
}
