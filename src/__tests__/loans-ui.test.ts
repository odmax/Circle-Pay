import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const service = readFile("src/lib/services/stokvel-dashboard.service.ts")
const listPage = readFile("src/app/(dashboard)/circles/[circleId]/loans/page.tsx")
const applyPage = readFile("src/app/(dashboard)/circles/[circleId]/loans/apply/page.tsx")
const detailPage = readFile("src/app/(dashboard)/circles/[circleId]/loans/[loanId]/page.tsx")
const listClient = readFile("src/components/loans/loans-client.tsx")
const applyClient = readFile("src/components/loans/loan-apply-client.tsx")
const detailClient = readFile("src/components/loans/loan-detail-client.tsx")
const widget = readFile("src/components/stokvel/stokvel-loan.tsx")
const dash = readFile("src/components/stokvel/stokvel-dashboard.tsx")
const quickActions = readFile("src/components/stokvel/stokvel-quick-actions.tsx")

describe("Loans UI — Route Seating", () => {
  it("LU1: pages require auth and redirect to login", () => {
    for (const p of [listPage, applyPage, detailPage]) {
      expect(p).toContain('redirect("/login")')
      expect(p).toContain("session?.user?.id")
    }
  })

  it("LU2: pages call notFound when circle/loan missing", () => {
    expect(listPage).toContain("notFound()")
    expect(applyPage).toContain("notFound()")
    expect(detailPage).toContain("notFound()")
  })

  it("LU3: pages wire the client components", () => {
    expect(listPage).toContain("LoansClient")
    expect(applyPage).toContain("LoanApplyClient")
    expect(detailPage).toContain("LoanDetailClient")
  })

  it("LU4: detail page computes isOwner from loan member match", () => {
    expect(detailPage).toContain("loan.memberId === session.user.id")
  })
})

describe("Loans UI — No Hardcoded Roles", () => {
  it("LU5: pages and service gate on permission engine, not roles", () => {
    for (const src of [listPage, applyPage, detailPage, service]) {
      expect(src).toContain("hasCirclePermission")
      expect(src).not.toContain('role === "OWNER"')
      expect(src).not.toContain('role === "ADMIN"')
    }
  })

  it("LU6: list page resolves all LOAN permissions", () => {
    for (const p of [
      "LOAN_APPLY",
      "LOAN_VIEW_ALL",
      "LOAN_REVIEW",
      "LOAN_APPROVE",
      "LOAN_DISBURSE",
      "LOAN_REPAYMENT_REVIEW",
      "LOAN_CONFIG_MANAGE",
    ]) {
      expect(listPage).toContain(p)
    }
  })

  it("LU7: detail page resolves the review/approve/disburse permissions", () => {
    for (const p of [
      "LOAN_APPLY",
      "LOAN_APPROVE",
      "LOAN_DISBURSE",
      "LOAN_REPAYMENT_REVIEW",
      "LOAN_REVIEW",
    ]) {
      expect(detailPage).toContain(p)
    }
  })
})

describe("Loans UI — Own-Loan & Cross-Circle Enforced", () => {
  it("LU8: list uses memberId filter for the 'mine' view", () => {
    expect(listClient).toContain("sorted.filter((l) => l.memberId === userId)")
  })

  it("LU9: detail honours canViewAny (elevated access) flag", () => {
    expect(detailClient).toContain("canViewAny")
    expect(detailClient).toContain("isHighAccess")
  })

  it("LU10: member-facing disclosure uses 'memberName' from service", () => {
    expect(detailClient).toContain("loan.memberName")
    expect(listClient).toContain("memberName")
  })
})

describe("Loans UI — Cannot Approve Own Loan", () => {
  it("LU11: approve/reject gated by !isOwner", () => {
    expect(detailClient).toContain("permissions.canApprove && !isOwner")
    expect(detailClient).toContain("permissions.canApprove &&\n    !isOwner")
    expect(detailClient).toContain("canRejectLoan")
  })

  it("LU12: shows explicit note to the owner", () => {
    expect(detailClient).toContain("can&apos;t approve your own loan")
    expect(detailClient).toContain("You can&apos;t approve your own loan")
  })
})

describe("Loans UI — Status Coverage & States", () => {
  it("LU13: list covers all loan status labels", () => {
    for (const s of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "DISBURSED", "REPAYING", "PAID_OFF", "OVERDUE", "DEFAULTED"]) {
      expect(listClient).toContain(`${s}: "`)
      expect(detailClient).toContain(`${s}: "`)
    }
  })

  it("LU14: detail covers schedule and repayment status labels", () => {
    for (const s of ["PENDING", "PROOF_SUBMITTED", "CONFIRMED", "REJECTED", "OVERDUE", "WAIVED"]) {
      expect(detailClient).toContain(`${s}: "`)
    }
  })

  it("LU15: list has loading skeletons", () => {
    expect(listClient).toContain("<Skeleton")
    expect(listClient).toContain("loading")
  })

  it("LU16: list has error + retry states", () => {
    expect(listClient).toContain("setError")
    expect(listClient).toContain("Retry")
  })

  it("LU17: list has empty states for All and Mine filters", () => {
    expect(listClient).toContain("You have no loans yet.")
    expect(listClient).toContain("No loans to display.")
  })

  it("LU18: detail has loading skeletons and error state", () => {
    expect(detailClient).toContain("<Skeleton")
    expect(detailClient).toContain("Loan not found.")
  })

  it("LU19: apply has disabled, no-permission and success states", () => {
    expect(applyClient).toContain("Loans are currently disabled")
    expect(applyClient).toContain("don&apos;t have permission to apply")
    expect(applyClient).toContain("Application submitted")
  })

  it("LU20: renders overdue + defaulted alert banners on list", () => {
    expect(listClient).toContain("Overdue loans")
    expect(listClient).toContain("Defaulted loans")
  })
})

describe("Loans UI — Responsive", () => {
  it("LU21: tables scroll horizontally on mobile", () => {
    expect(listClient).toContain("overflow-x-auto")
    expect(detailClient).toContain("overflow-x-auto")
  })

  it("LU22: summary cards use responsive grid breakpoints", () => {
    expect(listClient).toContain("sm:grid-cols-2 lg:grid-cols-4")
  })

  it("LU23: apply uses a responsive 3-col layout", () => {
    expect(applyClient).toContain("lg:grid-cols-3")
  })
})

describe("Loans UI — Stokvel Dashboard Integration", () => {
  it("LU24: service exposes loan block and 3 loan permissions", () => {
    expect(service).toContain("loan: {")
    expect(service).toContain("canViewLoans")
    expect(service).toContain("canReviewLoans")
    expect(service).toContain("canApplyLoans")
  })

  it("LU25: service resolves loan permissions via permission engine", () => {
    expect(service).toContain("LOAN_VIEW_OWN")
    expect(service).toContain("LOAN_REPAYMENT_REVIEW")
    expect(service).toContain("LOAN_APPLY")
  })

  it("LU26: widget is gated on canViewLoans", () => {
    expect(dash).toContain("permissions.canViewLoans &&")
    expect(dash).toContain("StokvelLoan")
  })

  it("LU27: widget renders member loan summary state", () => {
    expect(widget).toContain("myActiveLoans")
    expect(widget).toContain("outstandingBalance")
    expect(widget).toContain("nextRepayment")
  })

  it("LU28: widget shows admin portfolio only to reviewers", () => {
    expect(widget).toContain("canReviewLoans &&")
    expect(widget).toContain("Portfolio")
    expect(widget).toContain("repaymentRate")
  })

  it("LU29: widget surfaces overdue/defaulted banners and disabled state", () => {
    expect(widget).toContain("loan.defaulted")
    expect(widget).toContain("loan.overdue")
    expect(widget).toContain("!loan.enabled ?")
  })

  it("LU30: quick action links to the loans page behind canViewLoans", () => {
    expect(quickActions).toContain("canViewLoans")
    expect(quickActions).toContain('href: `/circles/${circleId}/loans`')
  })

  it("LU31: manage/apply links route under the circle loans routes", () => {
    expect(widget).toContain('href={`/circles/${circleId}/loans`}')
    expect(widget).toContain('href={`/circles/${circleId}/loans/apply`}')
    expect(listClient).toContain('href={`/circles/${circleId}/loans/apply`}')
    expect(listClient).toContain('href={`/circles/${circleId}/loans/${l.id}`}')
  })
})

describe("Loans UI — Client Exports", () => {
  it("LU32: all loan components export correctly", async () => {
    const listMod = await import("@/components/loans/loans-client")
    expect(typeof listMod.LoansClient).toBe("function")
    const applyMod = await import("@/components/loans/loan-apply-client")
    expect(typeof applyMod.LoanApplyClient).toBe("function")
    const detailMod = await import("@/components/loans/loan-detail-client")
    expect(typeof detailMod.LoanDetailClient).toBe("function")
    const widgetMod = await import("@/components/stokvel/stokvel-loan")
    expect(typeof widgetMod.StokvelLoan).toBe("function")
  })
})
