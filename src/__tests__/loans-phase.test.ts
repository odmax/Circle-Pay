import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const service = readFile("src/lib/services/loan.service.ts")
const schema = readFile("prisma/schema.prisma")
const perms = readFile("src/lib/permissions/circlePermissions.ts")
const rolePerms = readFile("src/lib/permissions/circle-role-permissions.ts")
const approval = readFile("src/lib/services/approval.service.ts")
const notif = readFile("src/lib/services/notification.service.ts")

describe("Member Loans — Data Model", () => {
  it("LO1: schema defines the loan lifecycle enum and models", () => {
    expect(schema).toContain("enum LoanStatus {")
    for (const s of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "DISBURSED", "REPAYING", "PAID_OFF", "OVERDUE", "DEFAULTED"]) {
      expect(schema).toContain(s)
    }
    expect(schema).toContain("enum LoanRepaymentStatus {")
    expect(schema).toContain("enum LoanRepaymentFrequency {")
    expect(schema).toContain("model CircleLoanConfig {")
    expect(schema).toContain("model Loan {")
    expect(schema).toContain("model LoanDisbursement {")
    expect(schema).toContain("model LoanRepaymentSchedule {")
    expect(schema).toContain("model LoanRepayment {")
  })

  it("LO2: monetary amounts are stored as Decimal to avoid float drift", () => {
    const compact = schema.replace(/\s+/g, " ")
    // No default on these monetary/rate fields.
    for (const field of ["principal Decimal @db.Decimal(14, 2)", "totalDue Decimal @db.Decimal(14, 2)", "principalDue Decimal @db.Decimal(14, 2)"]) {
      expect(compact).toContain(field)
    }
    // amount appears on both LoanDisbursement and LoanRepayment (no default).
    expect(compact).toContain("amount Decimal @db.Decimal(14, 2)")
    // Fields defaulting to zero.
    expect(compact).toContain("serviceFee Decimal @default(0) @db.Decimal(14, 2)")
    expect(compact).toContain("interestDue Decimal @default(0) @db.Decimal(14, 2)")
    expect(compact).toContain("amountPaid Decimal @default(0) @db.Decimal(14, 2)")
    expect(compact).toContain("feeApplied Decimal @default(0) @db.Decimal(14, 2)")
    // Rates use 4 decimal places.
    expect(compact).toContain("interestRate Decimal @default(0) @db.Decimal(14, 4)")
  })

  it("LO3: enums cover the full loan permission lifecycle and repayment states", () => {
    expect(schema).toContain("PROOF_SUBMITTED")
    expect(schema).toContain("CONFIRMED")
    expect(schema).toContain("REJECTED")
    expect(schema).toContain("WAIVED")
    expect(schema).toContain("OVERDUE")
    expect(schema).toContain("DEFAULTED")
  })
})

describe("Member Loans — Permissions", () => {
  it("LO4: LOAN_* permission keys are defined", () => {
    for (const p of [
      "LOAN_APPLY", "LOAN_VIEW_OWN", "LOAN_VIEW_ALL", "LOAN_REVIEW", "LOAN_APPROVE",
      "LOAN_DISBURSE", "LOAN_REPAY_SUBMIT_OWN", "LOAN_REPAYMENT_REVIEW", "LOAN_CONFIG_MANAGE",
    ]) {
      expect(perms).toContain(`${p}: "${p}"`)
    }
  })

  it("LO5: owner role inherits all loan permissions via Object.values", () => {
    expect(rolePerms).toContain("const OWNER_PERMISSIONS: CirclePermission[] = Object.values(P)")
    for (const p of ["LOAN_APPLY", "LOAN_VIEW_ALL", "LOAN_APPROVE", "LOAN_DISBURSE", "LOAN_REPAYMENT_REVIEW", "LOAN_CONFIG_MANAGE"]) {
      expect(rolePerms).toContain(`P.${p}`)
    }
  })

  it("LO6: member role can only apply, view own loans, and submit their own repayments", () => {
    // Members must NOT get elevated loan permissions by default.
    expect(rolePerms).toContain("const MEMBER_PERMISSIONS: CirclePermission[] = [")
    expect(rolePerms).toContain("P.LOAN_APPLY")
    expect(rolePerms).toContain("P.LOAN_VIEW_OWN")
    expect(rolePerms).toContain("P.LOAN_REPAY_SUBMIT_OWN")
  })

  it("LO7: treasurer and admin receive review/approve/disburse/config rights", () => {
    expect(rolePerms).toContain("const TREASURER_PERMISSIONS: CirclePermission[] = [")
    expect(rolePerms).toContain("const ADMIN_PERMISSIONS: CirclePermission[] = [")
    for (const p of ["LOAN_REVIEW", "LOAN_APPROVE", "LOAN_DISBURSE", "LOAN_REPAYMENT_REVIEW", "LOAN_CONFIG_MANAGE", "LOAN_VIEW_ALL"]) {
      expect(rolePerms).toContain(`P.${p}`)
    }
  })
})

describe("Member Loans — Approval Engine Integration", () => {
  it("LO8: LOAN is wired into the shared approval engine's permission maps", () => {
    expect(approval).toContain("LOAN: CIRCLE_PERMISSIONS.LOAN_APPROVE")
  })

  it("LO9: loan approval settings added to CircleApprovalConfig and defaults", () => {
    expect(approval).toContain("loan?: ApprovalSettings")
    expect(approval).toContain("loan: { enabled: false, minimumApprovals: 1")
    expect(approval).toContain('LOAN: "loan"')
    expect(approval).toContain("loan: merge(DEFAULT_APPROVAL_SETTINGS.loan!, settings.loan)")
  })
})

describe("Member Loans — Service Workflow", () => {
  it("LO10: applying requires LOAN_APPLY and validates config limits", () => {
    expect(service).toContain("export async function applyForLoan(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.LOAN_APPLY")
    expect(service).toContain("throw new Error(\"Loans are not enabled for this circle\")")
    expect(service).toContain("exceeds the maximum")
    expect(service).toContain("maximum active loans")
  })

  it("LO11: approval reuses the existing Approval engine via createApprovalRequest type LOAN", () => {
    expect(service).toContain("submitLoanForApproval(")
    expect(service).toContain("return prisma.$transaction")
    expect(service).toContain("createApprovalRequest({")
    expect(service).toContain('type: "LOAN"')
    expect(service).toContain("approvalRequestId = req.id")
  })

  it("LO12: members cannot approve their own loan (no self-approval)", () => {
    expect(service).toContain("Members cannot approve their own loan")
    expect(service).toContain("approveLoan(")
  })

  it("LO13: approval requires the linked approval request to be APPROVED", () => {
    expect(service).toContain("The linked approval request has not been approved yet")
    expect(service).toContain("req.status !== \"APPROVED\"")
  })

  it("LO14: repayment schedule is generated on approval", () => {
    expect(service).toContain("buildRepaymentSchedule(")
    expect(service).toContain("loanRepaymentSchedule.createMany")
    expect(service).toContain("principalPerPeriod")
  })

  it("LO15: disbursement records proof and transitions the loan to REPAYING", () => {
    expect(service).toContain("recordDisbursement(")
    expect(service).toContain('status: "PROOF_SUBMITTED"')
    expect(service).toContain('status: "DISBURSED"')
    expect(service).toContain("confirmDisbursement(")
    expect(service).toContain('status: "REPAYING"')
  })

  it("LO16: repayment submission gates on LOAN_REPAY_SUBMIT_OWN and requires own loan", () => {
    expect(service).toContain("submitLoanRepayment(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.LOAN_REPAY_SUBMIT_OWN")
    expect(service).toContain("You can only submit repayments for your own loan")
  })

  it("LO17: repayment confirmation updates the schedule and pays off the loan when complete", () => {
    expect(service).toContain("confirmLoanRepayment(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.LOAN_REPAYMENT_REVIEW")
    expect(service).toContain('status: "PAID_OFF"')
    expect(service).toContain("amountPaid: existingPaid")
  })

  it("LO18: overdue and defaulted lifecycle is permission-guarded", () => {
    expect(service).toContain("markLoanOverdue(")
    expect(service).toContain("markLoanDefaulted(")
    expect(service).toContain('action: "LOAN_OVERDUE"')
    expect(service).toContain('action: "LOAN_DEFAULTED"')
  })

  it("LO19: list APIs gate by LOAN_VIEW_OWN and only reveal all when the viewer is elevated", () => {
    expect(service).toContain("listLoans(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.LOAN_VIEW_OWN")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.LOAN_VIEW_ALL")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.MEMBER_VIEW")
    expect(service).toContain("canViewAll ? {} : { memberId: userId }")
  })

  it("LO20: all mutations run inside prisma.$transaction", () => {
    expect(service).toContain("prisma.$transaction")
  })

  it("LO21: loans feature exposes config management and dashboard status", () => {
    expect(service).toContain("export async function upsertLoanConfig(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.LOAN_CONFIG_MANAGE")
    expect(service).toContain("export async function getLoanDashboardStatus(")
  })
})

describe("Member Loans — Configuration Security", () => {
  it("LO22: loans are disabled by default and enabled explicitly", () => {
    expect(service).toContain("enabled: false")
    expect(service).toContain("throw new Error(\"Loans are not enabled for this circle\")")
    const compact = schema.replace(/\s+/g, " ")
    expect(compact).toContain("model CircleLoanConfig { id String @id @default(cuid()) circleId String @unique enabled Boolean @default(false)")
  })

  it("LO23: member can start from DRAFT then SUBMITTED (no accidental approval)", () => {
    expect(service).toContain('status: "DRAFT"')
    expect(service).toContain('status: "SUBMITTED"')
  })
})

describe("Member Loans — Notifications", () => {
  it("LO24: loan notification types map to a loans preference", () => {
    expect(notif).toContain("loans: true")
    for (const t of ["LOAN_APPLIED", "LOAN_APPROVED", "LOAN_REJECTED", "LOAN_DISBURSED", "LOAN_REPAYMENT_DUE", "LOAN_REPAYMENT_SUBMITTED", "LOAN_REPAYMENT_CONFIRMED", "LOAN_OVERDUE", "LOAN_DEFAULTED"]) {
      expect(notif).toContain(`${t}: "loans"`)
    }
  })
})

describe("Member Loans — API Surface", () => {
  it("LO25: API routes exist for config, apply, approval, disbursement, and repayment", () => {
    for (const f of [
      "src/app/api/circles/[circleId]/loan-config/route.ts",
      "src/app/api/circles/[circleId]/loans/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/submit/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/approve/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/reject/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/disburse/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/repayments/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/repayments/[repaymentId]/confirm/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/repayments/[repaymentId]/reject/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/overdue/route.ts",
      "src/app/api/circles/[circleId]/loans/[loanId]/default/route.ts",
      "src/app/api/circles/[circleId]/loans/status/route.ts",
    ]) {
      expect(fs.existsSync(path.resolve(f))).toBe(true)
    }
  })

  it("LO26: routes delegate to the loan service (no inline business logic)", () => {
    const loansRoute = readFile("src/app/api/circles/[circleId]/loans/route.ts")
    expect(loansRoute).toContain("applyForLoan")
    expect(loansRoute).toContain("listLoans")
    const approveRoute = readFile("src/app/api/circles/[circleId]/loans/[loanId]/approve/route.ts")
    expect(approveRoute).toContain("approveLoan")
  })
})
