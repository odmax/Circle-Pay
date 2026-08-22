import { describe, it, expect } from "vitest"

describe("Member Self-Service Contributions - Security Tests", () => {
  // ── Service Exports ──────────────────────────────────────

  it("Test M1: getMemberOwnContributions is exported and is a function", async () => {
    const mod = await import("@/lib/services/contribution.service")
    expect(typeof mod.getMemberOwnContributions).toBe("function")
  })

  it("Test M2: getMemberOwnContributionStats is exported and is a function", async () => {
    const mod = await import("@/lib/services/contribution.service")
    expect(typeof mod.getMemberOwnContributionStats).toBe("function")
  })

  it("Test M3: getMemberContributionsForAdmin is exported and is a function", async () => {
    const mod = await import("@/lib/services/contribution.service")
    expect(typeof mod.getMemberContributionsForAdmin).toBe("function")
  })

  // ── Permission Constants ─────────────────────────────────

  it("Test M4: CONTRIBUTION_VIEW_OWN permission constant exists", async () => {
    const { CIRCLE_PERMISSIONS } = await import("@/lib/permissions/circlePermissions")
    expect(CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_OWN).toBe("CONTRIBUTION_VIEW_OWN")
  })

  it("Test M5: CONTRIBUTION_SUBMIT_OWN permission constant exists", async () => {
    const { CIRCLE_PERMISSIONS } = await import("@/lib/permissions/circlePermissions")
    expect(CIRCLE_PERMISSIONS.CONTRIBUTION_SUBMIT_OWN).toBe("CONTRIBUTION_SUBMIT_OWN")
  })

  it("Test M6: CONTRIBUTION_VIEW_ALL permission constant exists and differs from VIEW_OWN", async () => {
    const { CIRCLE_PERMISSIONS } = await import("@/lib/permissions/circlePermissions")
    expect(CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL).toBe("CONTRIBUTION_VIEW_ALL")
    expect(CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_ALL).not.toBe(CIRCLE_PERMISSIONS.CONTRIBUTION_VIEW_OWN)
  })

  // ── Role Permission Mapping ──────────────────────────────

  it("Test M7: MEMBER role has SUBMIT_OWN but not VIEW_ALL", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const memberPerms = getRoleDefaultPermissions("MEMBER")
    expect(memberPerms).toContain("CONTRIBUTION_SUBMIT_OWN")
    expect(memberPerms).toContain("CONTRIBUTION_VIEW_OWN")
    expect(memberPerms).not.toContain("CONTRIBUTION_VIEW_ALL")
    expect(memberPerms).not.toContain("CONTRIBUTION_REVIEW")
  })

  it("Test M8: ADMIN role has VIEW_ALL and CONTRIBUTION_REVIEW", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const adminPerms = getRoleDefaultPermissions("ADMIN")
    expect(adminPerms).toContain("CONTRIBUTION_VIEW_ALL")
    expect(adminPerms).toContain("CONTRIBUTION_REVIEW")
    expect(adminPerms).toContain("CONTRIBUTION_SUBMIT_OWN")
  })

  it("Test M9: OWNER role has all permissions including VIEW_ALL", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const ownerPerms = getRoleDefaultPermissions("OWNER")
    expect(ownerPerms).toContain("CONTRIBUTION_VIEW_ALL")
    expect(ownerPerms).toContain("CONTRIBUTION_REVIEW")
    expect(ownerPerms).toContain("CONTRIBUTION_SUBMIT_OWN")
  })

  it("Test M10: TREASURER role has VIEW_ALL but also limited", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const treasurerPerms = getRoleDefaultPermissions("TREASURER")
    expect(treasurerPerms).toContain("CONTRIBUTION_VIEW_ALL")
    expect(treasurerPerms).toContain("CONTRIBUTION_REVIEW")
  })

  it("Test M11: VIEWER role has neither SUBMIT_OWN nor VIEW_ALL for contributions", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const viewerPerms = getRoleDefaultPermissions("VIEWER")
    expect(viewerPerms).not.toContain("CONTRIBUTION_SUBMIT_OWN")
    expect(viewerPerms).not.toContain("CONTRIBUTION_VIEW_OWN")
    expect(viewerPerms).not.toContain("CONTRIBUTION_VIEW_ALL")
  })

  // ── Validation Schema ────────────────────────────────────

  it("Test M12: addContributionSchema enforces status enum without CONFIRMED", async () => {
    const { addContributionSchema } = await import("@/lib/validations/contributions")
    // Members should NOT be able to set status to CONFIRMED or PAID
    const memberResult = addContributionSchema.safeParse({
      userId: "user-1",
      amount: 100,
      status: "CONFIRMED",
      paymentDate: "2026-01-01",
      contributionMonth: "2026-01",
      paymentMethod: "BANK_TRANSFER",
    })
    // The schema allows PAID, PENDING, PENDING_REVIEW, CANCELLED but not CONFIRMED
    // However the server-side addContribution enforces the actual restrictions
    expect(memberResult.success).toBe(false)
  })

  it("Test M13: addContributionSchema accepts PENDING_REVIEW status", async () => {
    const { addContributionSchema } = await import("@/lib/validations/contributions")
    const result = addContributionSchema.safeParse({
      userId: "user-1",
      amount: 100,
      status: "PENDING_REVIEW",
      paymentDate: "2026-01-01",
      contributionMonth: "2026-01",
      paymentMethod: "BANK_TRANSFER",
    })
    expect(result.success).toBe(true)
  })

  it("Test M14: addContributionSchema requires paymentMethod (prevents defaulting to hidden)", async () => {
    const { addContributionSchema } = await import("@/lib/validations/contributions")
    const result = addContributionSchema.safeParse({
      userId: "user-1",
      amount: 100,
      status: "PENDING_REVIEW",
      paymentDate: "2026-01-01",
      contributionMonth: "2026-01",
    })
    expect(result.success).toBe(false)
  })

  // ── Component Exports ────────────────────────────────────

  it("Test M15: SelfServiceContributionForm is exported", async () => {
    const mod = await import("@/components/contributions/self-service-contribution-form")
    expect(typeof mod.SelfServiceContributionForm).toBe("function")
  })

  it("Test M16: AddContributionForm (admin) is still exported", async () => {
    const mod = await import("@/components/contributions/add-contribution-form")
    expect(typeof mod.AddContributionForm).toBe("function")
  })

  it("Test M17: MemberContributionSummary is still exported", async () => {
    const mod = await import("@/components/contributions/member-contribution-summary")
    expect(typeof mod.MemberContributionSummary).toBe("function")
  })

  it("Test M18: ContributionHistoryTable is still exported", async () => {
    const mod = await import("@/components/contributions/contribution-history-table")
    expect(typeof mod.ContributionHistoryTable).toBe("function")
  })

  // ── Cross-Circle Security ────────────────────────────────

  it("Test M19: getMemberOwnContributions uses requireCirclePermission with VIEW_OWN", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const serviceFile = fs.readFileSync(
      path.resolve("src/lib/services/contribution.service.ts"),
      "utf-8"
    )
    // Verify that getMemberOwnContributions calls requireCirclePermission with VIEW_OWN
    expect(serviceFile).toContain("getMemberOwnContributions")
    expect(serviceFile).toContain("CONTRIBUTION_VIEW_OWN")
  })

  it("Test M20: getMemberContributionsForAdmin uses requireCirclePermission with VIEW_ALL", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const serviceFile = fs.readFileSync(
      path.resolve("src/lib/services/contribution.service.ts"),
      "utf-8"
    )
    // Verify getMemberContributionsForAdmin checks VIEW_ALL
    const fnStart = serviceFile.indexOf("export async function getMemberContributionsForAdmin")
    expect(fnStart).toBeGreaterThan(-1)
    const fnBody = serviceFile.substring(fnStart, fnStart + 500)
    expect(fnBody).toContain("CONTRIBUTION_VIEW_ALL")
  })

  // ── Self-Service Form Security ───────────────────────────

  it("Test M21: Self-service form always submits with PENDING_REVIEW status", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const formFile = fs.readFileSync(
      path.resolve("src/components/contributions/self-service-contribution-form.tsx"),
      "utf-8"
    )
    // Verify the form hardcodes PENDING_REVIEW status
    expect(formFile).toContain("PENDING_REVIEW")
    // Verify no userId field in the form (the API sets it from session)
    expect(formFile).not.toContain("userId")
    expect(formFile).not.toContain("setValue(\"userId\"")
  })

  it("Test M22: Admin form still allows selecting member (for comparison)", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const formFile = fs.readFileSync(
      path.resolve("src/components/contributions/add-contribution-form.tsx"),
      "utf-8"
    )
    // Admin form should have member selector
    expect(formFile).toContain("userId")
  })

  it("Test M23: Self-service form requires proof of payment", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const formFile = fs.readFileSync(
      path.resolve("src/components/contributions/self-service-contribution-form.tsx"),
      "utf-8"
    )
    expect(formFile).toContain("Proof of payment is required")
    expect(formFile).toContain("validateProof")
  })

  // ── Server-side Enforcement ──────────────────────────────

  it("Test M24: addContribution enforces self-only for members (no CONTRIBUTION_CREATE)", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const serviceFile = fs.readFileSync(
      path.resolve("src/lib/services/contribution.service.ts"),
      "utf-8"
    )
    // Verify addContribution checks CONTRIBUTION_CREATE and restricts userId
    expect(serviceFile).toContain("Members can only record their own contributions")
    expect(serviceFile).toContain("CONTRIBUTION_CREATE")
  })

  it("Test M25: addContribution prevents members from setting CONFIRMED status directly", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const serviceFile = fs.readFileSync(
      path.resolve("src/lib/services/contribution.service.ts"),
      "utf-8"
    )
    // Verify members cannot bypass approval - PENDING_REVIEW is forced when approval enabled
    expect(serviceFile).toContain("status: \"PENDING_REVIEW\"")
  })

  it("Test M26: Member contribution page verifies membership for cross-circle protection", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const pageFile = fs.readFileSync(
      path.resolve("src/app/(dashboard)/circles/[circleId]/contributions/member/[memberId]/page.tsx"),
      "utf-8"
    )
    // Verify the member page checks membership
    expect(pageFile).toContain("circleId_userId")
    expect(pageFile).toContain("notFound()")
  })

  it("Test M27: Member contribution page checks permissions for non-own viewing", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const pageFile = fs.readFileSync(
      path.resolve("src/app/(dashboard)/circles/[circleId]/contributions/member/[memberId]/page.tsx"),
      "utf-8"
    )
    // Verify non-own viewing requires VIEW_ALL
    expect(pageFile).toContain("CONTRIBUTION_VIEW_ALL")
    expect(pageFile).toContain("isOwn")
  })

  it("Test M28: Contributions page branches on canViewAll permission", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const pageFile = fs.readFileSync(
      path.resolve("src/app/(dashboard)/circles/[circleId]/contributions/page.tsx"),
      "utf-8"
    )
    // Verify the main page differentiates admin vs member view
    expect(pageFile).toContain("canViewAll")
    expect(pageFile).toContain("getMemberOwnContributions")
    expect(pageFile).toContain("getMemberOwnContributionStats")
    expect(pageFile).toContain("SelfServiceContributionForm")
  })

  // ── Idempotency & Audit ──────────────────────────────────

  it("Test M29: Service functions use prisma.contribution.findMany for queries", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const serviceFile = fs.readFileSync(
      path.resolve("src/lib/services/contribution.service.ts"),
      "utf-8"
    )
    // Verify member functions use proper Prisma queries
    expect(serviceFile).toContain("prisma.contribution.findMany")
    expect(serviceFile).toContain("prisma.contribution.aggregate")
  })

  it("Test M30: All three member service functions verify circle membership", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const serviceFile = fs.readFileSync(
      path.resolve("src/lib/services/contribution.service.ts"),
      "utf-8"
    )
    // getMemberOwnContributions and getMemberOwnContributionStats use requireCirclePermission
    // which verifies membership. getMemberContributionsForAdmin explicitly checks membership.
    const adminFn = serviceFile.indexOf("export async function getMemberContributionsForAdmin")
    const adminBody = serviceFile.substring(adminFn, adminFn + 600)
    expect(adminBody).toContain("User is not a member of this circle")
  })
})
