import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Permission Audit Trail", () => {
  // ── Schema & Service Existence ─────────────────────────

  it("Test PAT1: permission-audit.service.ts exports required functions", async () => {
    const mod = await import("@/lib/services/permission-audit.service")
    expect(typeof mod.logPermissionAuditEvent).toBe("function")
    expect(typeof mod.getPermissionAuditHistory).toBe("function")
  })

  it("Test PAT2: PERMISSION_AUDIT_ACTIONS covers all required actions", async () => {
    const { PERMISSION_AUDIT_ACTIONS } = await import("@/lib/services/permission-audit.service")
    expect(PERMISSION_AUDIT_ACTIONS.ROLE_CHANGED).toBe("CIRCLE_MEMBER_ROLE_CHANGED")
    expect(PERMISSION_AUDIT_ACTIONS.PERMISSION_GRANTED).toBe("CIRCLE_MEMBER_PERMISSION_GRANTED")
    expect(PERMISSION_AUDIT_ACTIONS.PERMISSION_DENIED).toBe("CIRCLE_MEMBER_PERMISSION_DENIED")
    expect(PERMISSION_AUDIT_ACTIONS.OVERRIDE_REMOVED).toBe("CIRCLE_MEMBER_PERMISSION_OVERRIDE_REMOVED")
    expect(PERMISSION_AUDIT_ACTIONS.MEMBER_REMOVED).toBe("CIRCLE_MEMBER_REMOVED")
    expect(PERMISSION_AUDIT_ACTIONS.OWNERSHIP_TRANSFERRED).toBe("CIRCLE_OWNERSHIP_TRANSFERRED")
  })

  // ── Schema Changes ─────────────────────────────────────

  it("Test PAT3: AuditLog schema includes affectedUserId field", async () => {
    const schema = await import("fs").then((fs) =>
      fs.promises.readFile("prisma/schema.prisma", "utf-8")
    )
    expect(schema).toContain("affectedUserId String?")
    expect(schema).toContain("@@index([affectedUserId])")
    expect(schema).toContain("@@index([action])")
  })

  it("Test PAT4: AuditLog schema includes reason field", async () => {
    const schema = await import("fs").then((fs) =>
      fs.promises.readFile("prisma/schema.prisma", "utf-8")
    )
    expect(schema).toContain("reason         String?")
  })

  it("Test PAT5: AuditLog has affectedUser relation", async () => {
    const schema = await import("fs").then((fs) =>
      fs.promises.readFile("prisma/schema.prisma", "utf-8")
    )
    expect(schema).toContain('relation("AuditLogAffectedUser"')
    expect(schema).toContain("@relation(\"AuditLogAffectedUser\"")
  })

  // ── circle-permission.service.ts uses permission audit ─

  it("Test PAT6: circle-permission.service.ts uses logPermissionAuditEvent", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/circle-permission.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("logPermissionAuditEvent")
    expect(src).toContain("permission-audit.service")
  })

  it("Test PAT7: circle-permission.service.ts no longer uses createAuditLog directly", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/circle-permission.service.ts",
        "utf-8"
      )
    )
    expect(src).not.toContain('import { createAuditLog }')
  })

  it("Test PAT8: role change audit includes affectedUserId", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/circle-permission.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("affectedUserId: member.userId")
  })

  it("Test PAT9: role change audit captures before/after permissions", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/circle-permission.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("previousPermissions")
    expect(src).toContain("newPermissions")
    expect(src).toContain("getRoleDefaultPermissions(oldRole)")
    expect(src).toContain("getRoleDefaultPermissions(role)")
  })

  it("Test PAT10: permission grant audit includes affectedUserId and permission", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/circle-permission.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("CIRCLE_MEMBER_PERMISSION_GRANTED")
    expect(src).toContain("CIRCLE_MEMBER_PERMISSION_DENIED")
    expect(src).toContain("oldValues: oldOverride")
  })

  it("Test PAT11: override removal audit includes affectedUserId", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/circle-permission.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("CIRCLE_MEMBER_PERMISSION_OVERRIDE_REMOVED")
    expect(src).toContain("affectedUserId: member.userId")
  })

  it("Test PAT12: member removal audit includes affectedUserId", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/circle-permission.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("CIRCLE_MEMBER_REMOVED")
    expect(src).toContain("affectedUserId: member.userId")
  })

  // ── Audit service supports new fields ──────────────────

  it("Test PAT13: createAuditLog accepts affectedUserId and reason", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/audit.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("affectedUserId")
    expect(src).toContain("reason")
  })

  // ── API Route ──────────────────────────────────────────

  it("Test PAT14: audit API route exists", async () => {
    const fs = await import("fs")
    const exists = fs.existsSync(
      "src/app/api/circles/[circleId]/permissions/audit/route.ts"
    )
    expect(exists).toBe(true)
  })

  it("Test PAT15: audit API route requires MEMBER_AUDIT_VIEW permission", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/api/circles/[circleId]/permissions/audit/route.ts",
        "utf-8"
      )
    )
    expect(src).toContain("MEMBER_AUDIT_VIEW")
    expect(src).toContain("hasCirclePermission")
  })

  it("Test PAT16: audit API route uses getPermissionAuditHistory", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/api/circles/[circleId]/permissions/audit/route.ts",
        "utf-8"
      )
    )
    expect(src).toContain("getPermissionAuditHistory")
  })

  it("Test PAT17: audit API route supports filters", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/api/circles/[circleId]/permissions/audit/route.ts",
        "utf-8"
      )
    )
    expect(src).toContain("affectedUserId")
    expect(src).toContain("actorUserId")
    expect(src).toContain("fromDate")
    expect(src).toContain("toDate")
    expect(src).toContain("action")
    expect(src).toContain("pageSize")
  })

  it("Test PAT18: audit API route caps pageSize at 100", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/api/circles/[circleId]/permissions/audit/route.ts",
        "utf-8"
      )
    )
    expect(src).toContain("Math.min(")
  })

  // ── Permission Definitions ─────────────────────────────

  it("Test PAT19: MEMBER_AUDIT_VIEW permission exists", async () => {
    const { CIRCLE_PERMISSIONS } = await import("@/lib/permissions/circlePermissions")
    expect((CIRCLE_PERMISSIONS as Record<string, string>).MEMBER_AUDIT_VIEW).toBe("MEMBER_AUDIT_VIEW")
  })

  it("Test PAT20: OWNER role has MEMBER_AUDIT_VIEW", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const perms = getRoleDefaultPermissions("OWNER")
    expect(perms).toContain("MEMBER_AUDIT_VIEW")
  })

  it("Test PAT21: ADMIN role has MEMBER_AUDIT_VIEW", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const perms = getRoleDefaultPermissions("ADMIN")
    expect(perms).toContain("MEMBER_AUDIT_VIEW")
  })

  it("Test PAT22: TREASURER role has MEMBER_AUDIT_VIEW", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const perms = getRoleDefaultPermissions("TREASURER")
    expect(perms).toContain("MEMBER_AUDIT_VIEW")
  })

  it("Test PAT23: MEMBER role does not have MEMBER_AUDIT_VIEW", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const perms = getRoleDefaultPermissions("MEMBER")
    expect(perms).not.toContain("MEMBER_AUDIT_VIEW")
  })

  it("Test PAT24: VIEWER role does not have MEMBER_AUDIT_VIEW", async () => {
    const { getRoleDefaultPermissions } = await import("@/lib/permissions/circle-role-permissions")
    const perms = getRoleDefaultPermissions("VIEWER")
    expect(perms).not.toContain("MEMBER_AUDIT_VIEW")
  })

  // ── UI Component ───────────────────────────────────────

  it("Test PAT25: circle-permissions-manager.tsx includes History import", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/circle-permissions-manager.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("History")
  })

  it("Test PAT26: circle-permissions-manager.tsx includes AuditHistorySection", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/circle-permissions-manager.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("AuditHistorySection")
  })

  it("Test PAT27: AuditHistorySection gated by MEMBER_AUDIT_VIEW", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/circle-permissions-manager.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("MEMBER_AUDIT_VIEW")
  })

  it("Test PAT28: AuditHistorySection has filter controls", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/circle-permissions-manager.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("filterMember")
    expect(src).toContain("filterActor")
    expect(src).toContain("filterAction")
    expect(src).toContain("Load History")
  })

  it("Test PAT29: AuditHistorySection has pagination", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/circle-permissions-manager.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("handlePageChange")
    expect(src).toContain("totalPages")
  })

  it("Test PAT30: MEMBER_AUDIT_VIEW in permission groups for management", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/components/circles/circle-permissions-manager.tsx",
        "utf-8"
      )
    )
    expect(src).toContain("MEMBER_AUDIT_VIEW")
  })

  // ── Security: No sensitive data exposure ───────────────

  it("Test PAT31: audit service does not store session/token data", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/permission-audit.service.ts",
        "utf-8"
      )
    )
    expect(src).not.toContain("session")
    expect(src).not.toContain("token")
    expect(src).not.toContain("password")
    expect(src).not.toContain("passwordHash")
  })

  it("Test PAT32: audit API route does not expose sensitive fields in response", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/api/circles/[circleId]/permissions/audit/route.ts",
        "utf-8"
      )
    )
    expect(src).not.toContain("passwordHash")
    expect(src).not.toContain("password")
    expect(src).not.toContain("token")
    expect(src).not.toContain("ipAddress")
    expect(src).not.toContain("userAgent")
  })

  // ── Immutability: no update/delete on audit logs ──────

  it("Test PAT33: audit service has no update or delete functions", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/audit.service.ts",
        "utf-8"
      )
    )
    expect(src).not.toContain("update")
    expect(src).not.toContain("delete")
  })

  it("Test PAT34: permission-audit.service has no update or delete functions", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/permission-audit.service.ts",
        "utf-8"
      )
    )
    expect(src).not.toContain(".update")
    expect(src).not.toContain(".delete")
  })

  it("Test PAT35: audit API route is read-only (GET only)", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/app/api/circles/[circleId]/permissions/audit/route.ts",
        "utf-8"
      )
    )
    expect(src).toContain("export async function GET")
    expect(src).not.toContain("export async function POST")
    expect(src).not.toContain("export async function PATCH")
    expect(src).not.toContain("export async function DELETE")
    expect(src).not.toContain("export async function PUT")
  })

  // ── Permission service functions are properly wired ────

  it("Test PAT36: getPermissionAuditHistory filters by actorUserId", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/permission-audit.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("where.userId = actorUserId")
  })

  it("Test PAT37: getPermissionAuditHistory filters by affectedUserId", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/permission-audit.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("where.affectedUserId = affectedUserId")
  })

  it("Test PAT38: getPermissionAuditHistory filters by date range", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/permission-audit.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("fromDate")
    expect(src).toContain("toDate")
    expect(src).toContain("gte")
    expect(src).toContain("lte")
  })

  it("Test PAT39: getPermissionAuditHistory resolves affected user details", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/permission-audit.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("affectedUser")
    expect(src).toContain("prisma.user.findMany")
  })

  it("Test PAT40: getPermissionAuditHistory returns pagination metadata", async () => {
    const src = await import("fs").then((fs) =>
      fs.promises.readFile(
        "src/lib/services/permission-audit.service.ts",
        "utf-8"
      )
    )
    expect(src).toContain("totalPages")
    expect(src).toContain("total,")
    expect(src).toContain("page,")
    expect(src).toContain("pageSize,")
  })
})
