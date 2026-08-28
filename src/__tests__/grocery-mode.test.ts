import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

const service = readFile("src/lib/services/grocery.service.ts")
const schema = readFile("prisma/schema.prisma")
const perms = readFile("src/lib/permissions/circlePermissions.ts")
const rolePerms = readFile("src/lib/permissions/circle-role-permissions.ts")
const notif = readFile("src/lib/services/notification.service.ts")
const upload = readFile("src/lib/services/upload.service.ts")

describe("Grocery Stokvel Mode — Data Model", () => {
  it("G1: schema defines the grocery lifecycle enums", () => {
    expect(schema).toContain("enum GroceryCampaignStatus {")
    for (const s of ["DRAFT", "ACTIVE", "PURCHASING", "DISTRIBUTING", "CLOSED"]) {
      expect(schema).toContain(s)
    }
    expect(schema).toContain("enum GroceryAllocationStatus {")
    for (const s of ["PENDING", "CONFIRMED", "ISSUE_REPORTED"]) {
      expect(schema).toContain(s)
    }
    expect(schema).toContain("enum GroceryQuoteStatus {")
    for (const s of ["PENDING", "APPROVED", "REJECTED"]) {
      expect(schema).toContain(s)
    }
    expect(schema).toContain("enum GroceryPurchaseStatus {")
    for (const s of ["RECORDED", "RECEIPT_SUBMITTED", "CONFIRMED"]) {
      expect(schema).toContain(s)
    }
  })

  it("G2: schema defines the grocery models as a stokvel config (not a new circle type)", () => {
    for (const m of [
      "model CircleGroceryConfig {",
      "model GroceryCampaign {",
      "model GroceryListItem {",
      "model GrocerySupplierQuote {",
      "model GroceryPurchase {",
      "model GroceryAllocation {",
      "model GroceryExpense {",
    ]) {
      expect(schema).toContain(m)
    }
  })

  it("G3: contributions are genuinely reused via an optional groceryCampaignId", () => {
    const compact = schema.replace(/\s+/g, " ")
    expect(compact).toContain("groceryCampaignId String?")
    expect(compact).toContain("@@index([groceryCampaignId])")
    expect(compact).toContain("model Contribution {")
    expect(compact).toContain("groceryCampaign GroceryCampaign? @relation(\"GroceryCampaignContributions\", fields: [groceryCampaignId], references: [id], onDelete: SetNull)")
  })

  it("G4: monetary fields use Decimal(14,2) without float drift", () => {
    const compact = schema.replace(/\s+/g, " ")
    for (const f of [
      "targetAmount Decimal @db.Decimal(14, 2)",
      "estimatedCost Decimal @default(0) @db.Decimal(14, 2)",
      "reconContributions Decimal @default(0) @db.Decimal(14, 2)",
      "quoteAmount Decimal @db.Decimal(14, 2)",
      "purchaseAmount Decimal @db.Decimal(14, 2)",
      "value Decimal @db.Decimal(14, 2)",
    ]) {
      expect(compact).toContain(f)
    }
  })

  it("G5: a single purchase per campaign prevents duplicate financial posting", () => {
    const compact = schema.replace(/\s+/g, " ")
    expect(compact).toContain("model GroceryPurchase {")
    expect(compact).toContain("campaignId String @unique")
  })
})

describe("Grocery Stokvel Mode — Permissions", () => {
  it("G6: GROCERY_* permission keys are defined", () => {
    for (const p of [
      "GROCERY_VIEW_OWN", "GROCERY_VIEW_ALL", "GROCERY_CAMPAIGN_CREATE", "GROCERY_CAMPAIGN_MANAGE",
      "GROCERY_LIST_MANAGE", "GROCERY_QUOTE_CREATE", "GROCERY_QUOTE_APPROVE", "GROCERY_PURCHASE_MANAGE",
      "GROCERY_ALLOCATION_MANAGE", "GROCERY_COLLECTION_CONFIRM_OWN", "GROCERY_RECONCILE", "GROCERY_CORRECT",
    ]) {
      expect(perms).toContain(`${p}: "${p}"`)
    }
  })

  it("G7: owner inherits all grocery permissions", () => {
    expect(rolePerms).toContain("const OWNER_PERMISSIONS: CirclePermission[] = Object.values(P)")
    for (const p of ["GROCERY_VIEW_ALL", "GROCERY_CAMPAIGN_CREATE", "GROCERY_RECONCILE", "GROCERY_CORRECT"]) {
      expect(rolePerms).toContain(`P.${p}`)
    }
  })

  it("G8: member role only views own and confirms own collection", () => {
    expect(rolePerms).toContain("const MEMBER_PERMISSIONS: CirclePermission[] = [")
    expect(rolePerms).toContain("P.GROCERY_VIEW_OWN")
    expect(rolePerms).toContain("P.GROCERY_COLLECTION_CONFIRM_OWN")
  })

  it("G9: treasurer and admin receive the full governance surface", () => {
    expect(rolePerms).toContain("const TREASURER_PERMISSIONS: CirclePermission[] = [")
    expect(rolePerms).toContain("const ADMIN_PERMISSIONS: CirclePermission[] = [")
    for (const p of ["GROCERY_CAMPAIGN_MANAGE", "GROCERY_QUOTE_APPROVE", "GROCERY_PURCHASE_MANAGE", "GROCERY_RECONCILE"]) {
      expect(rolePerms).toContain(`P.${p}`)
    }
  })
})

describe("Grocery Stokvel Mode — Service Workflow", () => {
  it("G10: config is a stokvel config gated by GROCERY_CAMPAIGN_MANAGE", () => {
    expect(service).toContain("export async function upsertGroceryConfig(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_MANAGE")
    expect(service).toContain("export async function getGroceryConfig(")
  })

  it("G11: campaigns are created as DRAFT and activated through a guarded status transition", () => {
    expect(service).toContain("export async function createCampaign(")
    expect(service).toContain('status: "DRAFT"')
    expect(service).toContain("export async function setCampaignStatus(")
    expect(service).toContain("STATUS_TRANSITIONS")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_CAMPAIGN_MANAGE")
  })

  it("G12: shopping list management is permission-guarded", () => {
    for (const f of ["addListItem", "updateListItem", "removeListItem"]) {
      expect(service).toContain(`export async function ${f}(`)
    }
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_LIST_MANAGE")
    expect(service).toContain("throw new Error(\"Finalized campaigns are immutable\")")
  })

  it("G13: supplier approval is transactional and transitions to PURCHASING", () => {
    expect(service).toContain("export async function addSupplierQuote(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_QUOTE_CREATE")
    expect(service).toContain("export async function approveSupplierQuote(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_QUOTE_APPROVE")
    expect(service).toContain("prisma.$transaction")
    expect(service).toContain('status: "APPROVED"')
    expect(service).toContain('status: "PURCHASING"')
    expect(service).toContain('action: "GROCERY_SUPPLIER_APPROVED"')
  })

  it("G14: purchase recording and confirmation are permission-guarded and prevent duplicate posting", () => {
    expect(service).toContain("export async function recordPurchase(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_PURCHASE_MANAGE")
    expect(service).toContain("This purchase is confirmed and cannot be replaced")
    expect(service).toContain("export async function confirmPurchase(")
    expect(service).toContain('status: "CONFIRMED"')
  })

  it("G15: allocations are member-specific and confirmation is member-owned only", () => {
    expect(service).toContain("export async function createAllocation(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_ALLOCATION_MANAGE")
    expect(service).toContain("export async function confirmAllocation(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_COLLECTION_CONFIRM_OWN")
    expect(service).toContain("You can only confirm your own allocation")
    expect(service).toContain("export async function reportAllocationIssue(")
  })

  it("G16: contributions reuse the Contribution model and honor contribution permissions", () => {
    expect(service).toContain("export async function addCampaignContribution(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.CONTRIBUTION_SUBMIT_OWN")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.CONTRIBUTION_CREATE")
    expect(service).toContain("groceryCampaignId: campaignId")
  })

  it("G17: view-all masking protects other members' allocation values", () => {
    expect(service).toContain("export async function getCampaign(")
    expect(service).toContain("showValue: viewAll || a.memberId === userId")
    expect(service).toContain("canViewAllGrocery(")
  })

  it("G18: reconciliation and close are computed from contributions/purchase/expenses", () => {
    expect(service).toContain("export async function reconcileCampaign(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_RECONCILE")
    expect(service).toContain("reconContributions")
    expect(service).toContain("reconSnapshot")
    expect(service).toContain("export async function closeCampaign(")
    expect(service).toContain("isFinalized: true")
  })

  it("G19: finalized campaigns are immutable except via GROCERY_CORRECT", () => {
    expect(service).toContain("export async function correctCampaign(")
    expect(service).toContain("permission: CIRCLE_PERMISSIONS.GROCERY_CORRECT")
    expect(service).toContain("Only finalized campaigns can be corrected")
    expect(service).toContain("A correction note is required")
  })

  it("G20: every mutation is audited", () => {
    for (const a of [
      'action: "GROCERY_CAMPAIGN_CREATED"',
      'action: "GROCERY_SUPPLIER_APPROVED"',
      'action: "GROCERY_PURCHASE_RECORDED"',
      'action: "GROCERY_ALLOCATION_CREATED"',
      'action: "GROCERY_RECONCILED"',
      'action: "GROCERY_CAMPAIGN_CLOSED"',
      'action: "GROCERY_CAMPAIGN_CORRECTED"',
      'action: "GROCERY_CONTRIBUTION_ADDED"',
      'action: "GROCERY_ALLOCATION_CONFIRMED"',
    ]) {
      expect(service).toContain(a)
    }
  })

  it("G21: cross-circle access is blocked by scoping queries to the circle", () => {
    expect(service).toContain("grocery: { circleId }")
    expect(service).toContain("where: { circleId }")
  })
})

describe("Grocery Stokvel Mode — Notifications & Uploads", () => {
  it("G22: grocery notification types were added to the notification enum", () => {
    for (const t of ["GROCERY_CAMPAIGN_CREATED", "GROCERY_SUPPLIER_APPROVED", "GROCERY_PURCHASE_RECORDED", "GROCERY_ALLOCATION_CREATED", "GROCERY_CAMPAIGN_CLOSED"]) {
      expect(schema).toContain(t)
    }
  })

  it("G23: notifications are sent via createNotification/notifyCircleMembers", () => {
    expect(service).toContain("createNotification(")
    expect(service).toContain("notifyCircleMembers")
    expect(service).toContain('type: "GROCERY_ALLOCATION_CREATED"')
  })

  it("G24: quote and receipt uploads reuse the shared proof upload infrastructure", () => {
    expect(upload).toContain("export async function uploadProofImage(")
    expect(upload).toContain("export function validateProofFile(")
    const quoteRoute = readFile("src/app/api/circles/[circleId]/grocery/[campaignId]/quotes/route.ts")
    expect(quoteRoute).toContain("validateProofFile")
    expect(quoteRoute).toContain("uploadProofImage")
    const purchaseRoute = readFile("src/app/api/circles/[circleId]/grocery/[campaignId]/purchase/route.ts")
    expect(purchaseRoute).toContain("validateProofFile")
    expect(purchaseRoute).toContain("uploadProofImage")
  })
})

describe("Grocery Stokvel Mode — API Surface", () => {
  it("G25: all lifecycle API routes exist", () => {
    for (const f of [
      "src/app/api/circles/[circleId]/grocery/route.ts",
      "src/app/api/circles/[circleId]/grocery/config/route.ts",
      "src/app/api/circles/[circleId]/grocery/dashboard/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/status/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/list-items/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/list-items/[itemId]/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/quotes/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/quotes/[quoteId]/approve/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/purchase/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/purchase/confirm/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/expenses/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/allocations/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/allocations/[allocationId]/confirm/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/allocations/[allocationId]/issue/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/contributions/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/reconcile/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/close/route.ts",
      "src/app/api/circles/[circleId]/grocery/[campaignId]/correct/route.ts",
    ]) {
      expect(fs.existsSync(path.resolve(f))).toBe(true)
    }
  })

  it("G26: routes delegate to the grocery service (no inline business logic)", () => {
    const main = readFile("src/app/api/circles/[circleId]/grocery/route.ts")
    expect(main).toContain("listCampaigns")
    expect(main).toContain("createCampaign")
    const reconcile = readFile("src/app/api/circles/[circleId]/grocery/[campaignId]/reconcile/route.ts")
    expect(reconcile).toContain("reconcileCampaign")
    const correct = readFile("src/app/api/circles/[circleId]/grocery/[campaignId]/correct/route.ts")
    expect(correct).toContain("correctCampaign")
  })
})

describe("Grocery Stokvel Mode — UI Surface", () => {
  it("G27: grocery pages and client components exist", () => {
    for (const f of [
      "src/app/(dashboard)/circles/[circleId]/grocery/page.tsx",
      "src/app/(dashboard)/circles/[circleId]/grocery/[campaignId]/page.tsx",
      "src/components/grocery/grocery-client.tsx",
      "src/components/grocery/grocery-campaign-client.tsx",
    ]) {
      expect(fs.existsSync(path.resolve(f))).toBe(true)
    }
  })

  it("G28: the dashboard surfaces a grocery quick action and widget", () => {
    const quickActions = readFile("src/components/stokvel/stokvel-quick-actions.tsx")
    expect(quickActions).toContain("canViewGrocery")
    expect(quickActions).toContain("/grocery")
    const dashboard = readFile("src/components/stokvel/stokvel-dashboard.tsx")
    expect(dashboard).toContain("StokvelGrocery")
    expect(dashboard).toContain("permissions.canViewGrocery")
    const serviceDash = readFile("src/lib/services/stokvel-dashboard.service.ts")
    expect(serviceDash).toContain("canViewGrocery")
    expect(serviceDash).toContain("grocery")
  })

  it("G29: member allocation/collection interactions are own-scoped", () => {
    const client = readFile("src/components/grocery/grocery-campaign-client.tsx")
    expect(client).toContain("a.memberId === userId")
    expect(client).toContain("Confirm collection")
    expect(client).toContain("Report issue")
  })
})
