import { describe, it, expect } from "vitest"

describe("Proof of Payment Verification - Phase 2", () => {
  it("Test V1: verification service exports correctly", async () => {
    const mod = await import("@/lib/services/proof-verification.service")
    expect(typeof mod.verifyContributionProof).toBe("function")
    expect(typeof mod.applyVerificationResult).toBe("function")
  })

  it("Test V2: proof-submission component exports", async () => {
    const mod = await import("@/components/contributions/proof-submission")
    expect(typeof mod.ProofSubmission).toBe("function")
  })

  it("Test V3: VerificationBadge exported from status badge", async () => {
    const mod = await import("@/components/contributions/contribution-status-badge")
    expect(typeof mod.VerificationBadge).toBe("function")
  })

  it("Test V4: proof-verification service file exists", async () => {
    const fs = await import("fs")
    const path = await import("path")
    expect(fs.existsSync(path.resolve("src/lib/services/proof-verification.service.ts"))).toBe(true)
  })

  it("Test V5: ContributionStatus includes PROOF_SUBMITTED", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toContain("PROOF_SUBMITTED")
  })

  it("Test V6: VerificationStatus enum exists in schema", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toContain("enum VerificationStatus")
    expect(schema).toContain("VERIFIED")
    expect(schema).toContain("NEEDS_REVIEW")
  })

  it("Test V7: Contribution model has proof fields", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8")
    expect(schema).toMatch(/proofUrl\s+String\?/)
    expect(schema).toMatch(/verificationStatus\s+VerificationStatus/)
    expect(schema).toMatch(/confidenceScore\s+Float\?/)
    expect(schema).toMatch(/extractedAmount\s+Decimal/)
    expect(schema).toMatch(/paymentMethod\s+String\?/)
    expect(schema).toMatch(/contributionMonth\s+String\?/)
  })

  it("Test V8: upload service exports validateProofFile and uploadProofImage", async () => {
    const mod = await import("@/lib/services/upload.service")
    expect(typeof mod.validateProofFile).toBe("function")
    expect(typeof mod.uploadProofImage).toBe("function")
  })

  it("Test V9: status badge includes all new statuses", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/contributions/contribution-status-badge.tsx"), "utf-8")
    expect(src).toContain("PENDING_REVIEW")
    expect(src).toContain("PROOF_SUBMITTED")
    expect(src).toContain("CONFIRMED")
    expect(src).toContain("REJECTED")
    expect(src).toContain("VERIFIED")
    expect(src).toContain("NEEDS_REVIEW")
  })

  it("Test V10: proof-submission supports upload and verify actions", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/contributions/proof-submission.tsx"), "utf-8")
    expect(src).toContain("upload-proof")
    expect(src).toContain("verify")
    expect(src).toContain("approve")
  })

  it("Test V11: contribution route handles POST with proof action", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/app/api/circles/[circleId]/contributions/[contributionId]/route.ts"), "utf-8")
    expect(src).toContain("upload-proof")
    expect(src).toContain("verify")
    expect(src).toContain('action === "approve"')
    expect(src).toContain('action === "reject"')
  })

  it("Test V12: contributions page renders proof-aware history table", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/app/(dashboard)/circles/[circleId]/contributions/page.tsx"), "utf-8")
    expect(src).toContain("ContributionHistoryTable")
  })

  it("Test V13: add-contribution-schema requires month, method, and supports reference", async () => {
    const mod = await import("@/lib/validations/contributions")
    const { addContributionSchema } = mod
    const r1 = addContributionSchema.safeParse({
      userId: "u1",
      amount: 100,
      status: "PENDING_REVIEW",
      paymentDate: "2026-01-15",
      contributionMonth: "2026-01",
      paymentMethod: "BANK_TRANSFER",
    })
    expect(r1.success).toBe(true)
    const r2 = addContributionSchema.safeParse({
      userId: "u1",
      amount: 100,
      status: "PENDING_REVIEW",
      paymentDate: "2026-01-15",
      contributionMonth: "",
      paymentMethod: "BANK_TRANSFER",
    })
    expect(r2.success).toBe(false)
    const r3 = addContributionSchema.safeParse({
      userId: "u1",
      amount: 100,
      status: "PENDING_REVIEW",
      paymentDate: "2026-01-15",
      contributionMonth: "2026-01",
      paymentMethod: "BANK_TRANSFER",
      proofReference: "EFT-123",
    })
    expect(r3.success).toBe(true)
  })

  it("Test V14: add-contribution-form requires proof file input", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/contributions/add-contribution-form.tsx"), "utf-8")
    expect(src).toContain("proof-upload")
    expect(src).toContain("Proof of payment is required")
    expect(src).toContain("upload-proof")
    expect(src).toContain("action=verify")
    expect(src).toContain("PENDING_REVIEW")
  })

  it("Test V15: contribution route records audit logs and notifies member", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/app/api/circles/[circleId]/contributions/[contributionId]/route.ts"), "utf-8")
    expect(src).toContain("createAuditLog")
    expect(src).toContain("PROOF_UPLOADED")
    expect(src).toContain("PROOF_VERIFICATION_COMPLETED")
    expect(src).toContain("confirmContribution")
    expect(src).toContain("rejectContribution")
    expect(src).toContain("createNotification")
  })

  it("Test V16: contribution service persists proof metadata", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/lib/services/contribution.service.ts"), "utf-8")
    expect(src).toContain("contributionMonth: data.contributionMonth")
    expect(src).toContain("paymentMethod: data.paymentMethod")
    expect(src).toContain("proofReference: data.proofReference")
  })

  it("Test V17: upload service allows PDF proofs", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/lib/services/upload.service.ts"), "utf-8")
    expect(src).toContain("application/pdf")
  })

  it("Test V18: verification service applies results with all fields", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/lib/services/proof-verification.service.ts"), "utf-8")
    expect(src).toContain("verificationStatus")
    expect(src).toContain("confidenceScore")
    expect(src).toContain("extractedAmount")
    expect(src).toContain("extractedDate")
    expect(src).toContain("extractedReference")
    expect(src).toContain("extractedSender")
    expect(src).toContain("verificationReason")
  })

  it("Test V19: history table renders proof actions", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const src = fs.readFileSync(path.resolve("src/components/contributions/contribution-history-table.tsx"), "utf-8")
    expect(src).toContain("ProofSubmission")
    expect(src).toContain("verificationStatus")
    expect(src).toContain("proofUrl")
  })
})
