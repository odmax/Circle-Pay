import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(relativePath))
}

const service = readFile("src/lib/services/loan.service.ts")
const uploadSvc = readFile("src/lib/services/upload.service.ts")
const schema = readFile("prisma/schema.prisma")
const detailUI = readFile("src/components/loans/loan-detail-client.tsx")
const repayRoute = readFile("src/app/api/circles/[circleId]/loans/[loanId]/repayments/proof/route.ts")
const disbRoute = readFile("src/app/api/circles/[circleId]/loans/[loanId]/disburse/proof/route.ts")

describe("Loan Proof Uploads — Data Model", () => {
  it("LP1: schema defines the LoanProof model with file metadata", () => {
    expect(schema).toContain("model LoanProof {")
    for (const f of [["loanId", "String"], ["circleId", "String"], ["uploadedById", "String"], ["fileUrl", "String"], ["filename", "String"], ["mimeType", "String"], ["size", "Int"], ["uploadedAt", "DateTime"], ["note", "String"], ["reference", "String"]]) {
      expect(schema).toMatch(new RegExp(`^\\s*${f[0]}\\s+${f[1]}[?@]?`, "m"))
    }
    expect(schema).toMatch(/^\s*repaymentId\s+String\?/m)
    expect(schema).toMatch(/^\s*disbursementId\s+String\?/m)
  })

  it("LP2: schema defines a kind enum for REPAYMENT and DISBURSEMENT proofs", () => {
    expect(schema).toContain("enum LoanProofKind {")
    expect(schema).toContain("REPAYMENT")
    expect(schema).toContain("DISBURSEMENT")
  })

  it("LP3: LoanProof is related to Loan, Circle, resolver and uploader", () => {
    expect(schema).toContain('uploadedBy   User             @relation("LoanProofUploader"')
    expect(schema).toContain("repayment    LoanRepayment?")
    expect(schema).toContain("disbursement LoanDisbursement?")
    expect(schema).toContain("@@index([loanId])")
    expect(schema).toContain("@@index([repaymentId])")
    expect(schema).toContain("@@index([disbursementId])")
    expect(schema).toContain("@@index([circleId])")
  })
})

describe("Loan Proof Uploads — Membership & Cross-Circle Rules", () => {
  it("LP4: repayment proof upload requires LOAN_REPAY_SUBMIT_OWN", () => {
    expect(service).toContain("recordLoanRepaymentProof(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.LOAN_REPAY_SUBMIT_OWN")
  })

  it("LP5: members cannot upload proof for another member's loan", () => {
    expect(service).toContain("You can only upload proof for your own loan")
    expect(service).toContain("!isOwner && !canSubmitForOthers")
  })

  it("LP6: repayment proof is scoped to the loan's circle (cross-circle blocked)", () => {
    expect(service).toContain("getLoanOrThrow(circleId, loanId)")
    expect(service).toContain('where: { id: data.scheduleId, loanId, circleId }')
  })

  it("LP7: disbursement proof upload requires LOAN_DISBURSE", () => {
    expect(service).toContain("recordDisbursementProof(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.LOAN_DISBURSE")
  })
})

describe("Loan Proof Uploads — Replacement Rules", () => {
  it("LP8: a confirmed repayment's proof cannot be silently replaced", () => {
    expect(service).toContain("Confirmed repayment proof cannot be replaced")
    expect(service).toContain('existing.status === "CONFIRMED"')
  })

  it("LP9: a confirmed schedule cannot be changed", () => {
    expect(service).toContain("This repayment period is already confirmed and cannot be changed")
  })

  it("LP10: replacement reuses the same repayment row (no duplicate posting)", () => {
    expect(service).toContain("tx.loanRepayment.update")
    expect(service).toContain("wasReplacement")
    // Confirmation (the only financial posting point) only updates amountPaid at CONFIRM time.
    expect(service).toContain('status: "PROOF_SUBMITTED"')
  })

  it("LP11: replacement history stays auditable via loanProof rows + audit logs", () => {
    expect(service).toContain("LOAN_REPAYMENT_PROOF_REPLACED")
    expect(service).toContain("LOAN_DISBURSEMENT_PROOF_REPLACED")
    expect(service).toContain("oldValues:")
    expect(service).toContain("newValues:")
    expect(service).toContain("tx.loanProof.create")
  })
})

describe("Loan Proof Uploads — File Validation & Storage", () => {
  it("LP12: reuses the shared upload service (validate + store)", () => {
    for (const route of [repayRoute, disbRoute]) {
      expect(route).toContain("validateProofFile")
      expect(route).toContain("uploadProofImage")
      expect(route).toContain("multipart/form-data")
    }
  })

  it("LP13: accepts the documented file types and caps at 5MB", () => {
    expect(uploadSvc).toContain("application/pdf")
    expect(uploadSvc).toContain("image/jpeg")
    expect(uploadSvc).toContain("image/png")
    expect(uploadSvc).toContain("image/webp")
    expect(uploadSvc).toContain("image/heic")
    expect(uploadSvc).toContain("MAX_SIZE = 5 * 1024 * 1024")
  })

  it("LP14: rejects oversized and disallowed file types", () => {
    expect(uploadSvc).toContain("Maximum size is 5MB")
    expect(uploadSvc).toContain("Use JPEG, PNG, WebP, or HEIC")
  })

  it("LP15: routes require auth", () => {
    for (const route of [repayRoute, disbRoute]) {
      expect(route).toContain('Unauthorized"')
      expect(route).toContain("session?.user?.id")
    }
  })
})

describe("Loan Proof Uploads — Read Surface", () => {
  it("LP16: getLoan returns proof history on repayments and a disbursement block", () => {
    expect(service).toContain("loanProof.findMany")
    expect(service).toContain("loanDisbursement.findUnique({ where: { loanId } })")
    expect(service).toContain("proofs: loanProofs.filter")
    expect(service).toContain("disbursement:")
  })

  it("LP17: proof payload carries uploader + file metadata", () => {
    expect(service).toContain("uploadedByName")
    expect(service).toContain("uploadedById")
    expect(service).toContain("uploadedAt")
    expect(service).toContain("filename")
    expect(service).toContain("mimeType")
    expect(service).toContain("size:")
  })
})

describe("Loan Proof Uploads — UI", () => {
  it("LP18: repayment form uploads a real file (not only a reference string)", () => {
    expect(detailUI).toContain("type=\"file\"")
    expect(detailUI).toContain("repayFile")
    expect(detailUI).toContain("repayments/proof")
    expect(detailUI).toContain("max 5MB")
  })

  it("LP19: disbursement form uploads a real file to the proof route", () => {
    expect(detailUI).toContain("disbFile")
    expect(detailUI).toContain("disburse/proof")
    expect(detailUI).toContain("Upload proof & record")
  })

  it("LP20: UI can preview/download proof files", () => {
    expect(detailUI).toContain("ProofPreview")
    expect(detailUI).toContain("target=\"_blank\"")
    expect(detailUI).toContain("proof.fileUrl")
  })

  it("LP21: no proof-reference-only text inputs remain on the forms", () => {
    expect(detailUI).not.toContain("repayProofUrl")
    expect(detailUI).not.toContain("repayProofRef")
    expect(detailUI).not.toContain("disbProofRef")
  })
})

describe("Loan Proof Uploads — API Surface", () => {
  it("LP22: proof upload routes exist", () => {
    expect(exists("src/app/api/circles/[circleId]/loans/[loanId]/repayments/proof/route.ts")).toBe(true)
    expect(exists("src/app/api/circles/[circleId]/loans/[loanId]/disburse/proof/route.ts")).toBe(true)
  })

  it("LP23: routes delegate to the loan proof service (no inline business logic)", () => {
    expect(repayRoute).toContain("recordLoanRepaymentProof")
    expect(disbRoute).toContain("recordDisbursementProof")
  })
})
