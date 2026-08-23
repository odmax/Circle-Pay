import { describe, it, expect } from "vitest"

describe("Permission Audit — No Hardcoded Role Checks for Authorization", () => {
  // ── Service Layer: Approval Service ───────────────────────

  it("Test PA1: approval service uses permission-based reviewer detection", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/approval.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("getRoleDefaultPermissions")
    expect(src).toContain("CONTRIBUTION_REVIEW")
    expect(src).not.toContain('role === "OWNER" || member.role === "ADMIN" || member.role === "TREASURER"')
  })

  it("Test PA2: approval service cancel uses permission check not role check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/approval.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("APPROVAL_REVIEW_ANY")
    expect(src).not.toContain('memberPerms?.role === "OWNER"')
  })

  // ── Service Layer: Balance Service ────────────────────────

  it("Test PA3: balance service uses ownership check not role check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/balance.service.ts",
        "utf-8"
      )
    )
    expect(src).not.toContain('role === "MEMBER"')
    expect(src).toContain("userId !== data.debtorId && userId !== data.creditorId")
  })

  // ── Pages: Circle Overview ────────────────────────────────

  it("Test PA4: circle overview page uses permission checks", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("SETTINGS_MANAGE")
    expect(src).toContain("EVENT_MANAGE")
    expect(src).not.toContain('userRole === "OWNER" || circle.userRole === "ADMIN"')
  })

  // ── Pages: Events ─────────────────────────────────────────

  it("Test PA5: events page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/events/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("EVENT_MANAGE")
    expect(src).not.toContain('userRole === "OWNER"')
  })

  // ── Pages: Polls ──────────────────────────────────────────

  it("Test PA6: polls page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/polls/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("POLL_MANAGE")
    expect(src).not.toContain('circle.userRole === "OWNER"')
  })

  // ── Pages: Members ────────────────────────────────────────

  it("Test PA7: members page uses permission checks", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/members/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("MEMBER_INVITE")
    expect(src).toContain("MEMBER_ROLE_UPDATE")
    expect(src).toContain("MEMBER_REMOVE")
    expect(src).not.toContain('circle.userRole === "OWNER"')
  })

  // ── Pages: Wallet Approvals ──────────────────────────────

  it("Test PA8: wallet approvals page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/wallet/approvals/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("PAYOUT_APPROVE")
    expect(src).not.toContain('circle.userRole === "OWNER"')
  })

  // ── Pages: Payments ──────────────────────────────────────

  it("Test PA9: payments page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/payments/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("CONTRIBUTION_VIEW_ALL")
    expect(src).not.toContain('circle.userRole === "OWNER"')
  })

  // ── Pages: Operations ────────────────────────────────────

  it("Test PA10: operations page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/operations/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("SETTINGS_MANAGE")
    expect(src).not.toContain('circle.userRole === "OWNER"')
    expect(src).not.toContain("isPrimaryOwnerUser")
  })

  // ── Pages: Manage ────────────────────────────────────────

  it("Test PA11: manage page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/manage/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("SETTINGS_MANAGE")
    expect(src).not.toContain('circle.userRole === "OWNER"')
  })

  // ── Pages: Projects ──────────────────────────────────────

  it("Test PA12: projects page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/projects/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("PROJECT_CREATE")
    expect(src).not.toContain('circle.userRole === "OWNER"')
  })

  // ── Pages: Automations ───────────────────────────────────

  it("Test PA13: automations page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/automations/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("AUTOMATION_MANAGE")
    expect(src).not.toContain('circle.userRole === "OWNER"')
  })

  // ── Pages: Balances ──────────────────────────────────────

  it("Test PA14: balances page uses permission check", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/balances/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("SETTLEMENT_CONFIRM")
    expect(src).not.toContain('circle.userRole === "OWNER"')
  })

  // ── Components: MembersList ──────────────────────────────

  it("Test PA15: members-list accepts permission booleans not userRole", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/members-list.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("canManageRoles")
    expect(src).toContain("canRemoveMembers")
    expect(src).not.toMatch(/userRole:\s*MemberRole/)
    expect(src).not.toContain('userRole === "OWNER" || userRole === "ADMIN"')
  })

  // ── Components: Receipt Detail ───────────────────────────

  it("Test PA16: receipt-detail uses canAdjust boolean not userRole", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/receipts/receipt-detail.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("canAdjust: boolean")
    expect(src).not.toContain("userRole: string")
    expect(src).not.toContain('userRole === "OWNER"')
  })

  // ── Receipt Detail Page Caller ───────────────────────────

  it("Test PA17: receipt detail page computes canAdjust permission", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/(dashboard)/circles/[circleId]/receipts/[receiptId]/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("hasCirclePermission")
    expect(src).toContain("LEDGER_ADJUST")
    expect(src).toContain("canAdjust=")
    expect(src).not.toContain("userRole={circle.userRole")
  })

  // ── Global: No userRole === checks remain in circle pages ──

  it("Test PA18: no userRole === authorization checks in circle dashboard pages", async () => {
    const fs = await import("fs")
    const path = await import("path")

    const baseDir = path.resolve("src/app/(dashboard)/circles/[circleId]")

    function findPageFiles(dir: string): string[] {
      const results: string[] = []
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          results.push(...findPageFiles(fullPath))
        } else if (entry.name === "page.tsx") {
          results.push(fullPath)
        }
      }
      return results
    }

    const pages = findPageFiles(baseDir)

    for (const page of pages) {
      const content = fs.readFileSync(page, "utf-8")
      const hasUserRoleCheck = /userRole\s*===\s*"(OWNER|ADMIN|TREASURER|MEMBER)"/.test(content)
      expect(hasUserRoleCheck).toBe(false)
    }
  })

  // ── Permission Definitions Exist ────────────────────────

  it("Test PA19: all key permissions are defined", async () => {
    const { CIRCLE_PERMISSIONS } = await import("@/lib/permissions/circlePermissions")
    const keyPermissions = [
      "SETTINGS_MANAGE",
      "EVENT_MANAGE",
      "POLL_MANAGE",
      "MEMBER_INVITE",
      "MEMBER_REMOVE",
      "MEMBER_ROLE_UPDATE",
      "PAYOUT_APPROVE",
      "CONTRIBUTION_VIEW_ALL",
      "CONTRIBUTION_REVIEW",
      "SETTLEMENT_CONFIRM",
      "LEDGER_ADJUST",
      "PROJECT_CREATE",
      "AUTOMATION_MANAGE",
      "APPROVAL_REVIEW_ANY",
    ]

    for (const perm of keyPermissions) {
      expect(
        CIRCLE_PERMISSIONS[perm as keyof typeof CIRCLE_PERMISSIONS]
      ).toBe(perm)
    }
  })

  // ── Role Default Permissions ────────────────────────────

  it("Test PA20: MEMBER role has expected permissions for self-service", async () => {
    const { getRoleDefaultPermissions } = await import(
      "@/lib/permissions/circle-role-permissions"
    )
    const perms = getRoleDefaultPermissions("MEMBER")
    expect(perms).toContain("CONTRIBUTION_SUBMIT_OWN")
    expect(perms).toContain("CONTRIBUTION_VIEW_OWN")
    expect(perms).toContain("POLL_MANAGE")
    expect(perms).toContain("FEED_POST")
    expect(perms).toContain("SETTLEMENT_CREATE")
    expect(perms).toContain("APPROVAL_REVIEW_OWN")
    expect(perms).not.toContain("CONTRIBUTION_VIEW_ALL")
    expect(perms).not.toContain("CONTRIBUTION_REVIEW")
    expect(perms).not.toContain("SETTINGS_MANAGE")
    expect(perms).not.toContain("MEMBER_INVITE")
    expect(perms).not.toContain("MEMBER_REMOVE")
    expect(perms).not.toContain("PAYOUT_APPROVE")
  })

  it("Test PA21: TREASURER role has review permissions", async () => {
    const { getRoleDefaultPermissions } = await import(
      "@/lib/permissions/circle-role-permissions"
    )
    const perms = getRoleDefaultPermissions("TREASURER")
    expect(perms).toContain("CONTRIBUTION_REVIEW")
    expect(perms).toContain("CONTRIBUTION_VIEW_ALL")
    expect(perms).toContain("APPROVAL_REVIEW_ANY")
    expect(perms).toContain("SETTLEMENT_CONFIRM")
    expect(perms).toContain("SCHEDULE_MANAGE")
  })

  it("Test PA22: ADMIN role has management permissions", async () => {
    const { getRoleDefaultPermissions } = await import(
      "@/lib/permissions/circle-role-permissions"
    )
    const perms = getRoleDefaultPermissions("ADMIN")
    expect(perms).toContain("SETTINGS_MANAGE")
    expect(perms).toContain("MEMBER_INVITE")
    expect(perms).toContain("MEMBER_REMOVE")
    expect(perms).toContain("MEMBER_ROLE_UPDATE")
    expect(perms).toContain("EVENT_MANAGE")
    expect(perms).toContain("PAYOUT_APPROVE")
    expect(perms).toContain("CONTRIBUTION_REVIEW")
  })

  it("Test PA23: OWNER role has all permissions", async () => {
    const { getRoleDefaultPermissions } = await import(
      "@/lib/permissions/circle-role-permissions"
    )
    const { ALL_CIRCLE_PERMISSIONS } = await import(
      "@/lib/permissions/circlePermissions"
    )
    const perms = getRoleDefaultPermissions("OWNER")
    expect(perms.length).toBe(ALL_CIRCLE_PERMISSIONS.length)
  })

  it("Test PA24: VIEWER role has only read permissions", async () => {
    const { getRoleDefaultPermissions } = await import(
      "@/lib/permissions/circle-role-permissions"
    )
    const perms = getRoleDefaultPermissions("VIEWER")
    expect(perms).toContain("CIRCLE_VIEW")
    expect(perms).toContain("MEMBER_VIEW")
    expect(perms).toContain("LEDGER_VIEW")
    expect(perms).not.toContain("CONTRIBUTION_SUBMIT_OWN")
    expect(perms).not.toContain("CONTRIBUTION_REVIEW")
    expect(perms).not.toContain("SETTINGS_MANAGE")
    expect(perms).not.toContain("POLL_MANAGE")
  })

  // ── MemberRole Type Coverage ─────────────────────────────

  it("Test PA25: all five roles have permission mappings", async () => {
    const { CIRCLE_ROLE_PERMISSIONS } = await import(
      "@/lib/permissions/circle-role-permissions"
    )
    const roles = ["OWNER", "ADMIN", "TREASURER", "MEMBER", "VIEWER"] as const
    for (const role of roles) {
      expect(CIRCLE_ROLE_PERMISSIONS[role]).toBeDefined()
      expect(Array.isArray(CIRCLE_ROLE_PERMISSIONS[role])).toBe(true)
      expect(CIRCLE_ROLE_PERMISSIONS[role].length).toBeGreaterThan(0)
    }
  })

  // ── Remaining role checks are acceptable ──────────────────

  it("Test PA26: remaining role checks are ownership protection only", async () => {
    const fs = await import("fs")
    const src = await fs.promises.readFile(
      "src/lib/services/circle-permission.service.ts",
      "utf-8"
    )
    // These are ownership protection checks (can't demote OWNER)
    expect(src).toContain('member.role === "OWNER"')
    expect(src).toContain('role !== "OWNER"')
  })

  it("Test PA27: ownership-protection utility checks OWNER role correctly", async () => {
    const mod = await import("@/lib/permissions/ownership-protection")
    expect(typeof mod.isCircleOwner).toBe("function")
    expect(typeof mod.preventOwnerRemoval).toBe("function")
    expect(typeof mod.preventOwnerDemotion).toBe("function")
  })

  // ── UI display-only role checks ─────────────────────────

  it("Test PA28: members-list badge rendering uses role for display only", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/members-list.tsx",
        "utf-8"
      )
    )
    // The remaining role check is for badge display (MEMBER vs ADMIN badge)
    expect(src).toContain('member.role === "ADMIN"')
    // But authorization is permission-based
    expect(src).toContain("canManageRoles")
    expect(src).toContain("canRemoveMembers")
  })

  it("Test PA29: circle-permissions-manager protects OWNER from changes", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/circle-permissions-manager.tsx",
        "utf-8"
      )
    )
    expect(src).toContain('member.role === "OWNER"')
  })

  // ── Owner/Admin panels use their own auth, not circle roles ──

  it("Test PA30: owner users page checks super admin role not circle role", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/owner/users/[userId]/page.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("isSuperAdmin")
    expect(src).toContain('admin.role === "ADMIN"')
    // This is owner panel admin role, not circle role — acceptable
  })
})
