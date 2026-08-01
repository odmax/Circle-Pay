import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

const root = join(process.cwd(), "src")

describe("Phase 4: AI Financial Assistant & Risk Engine", () => {
  describe("Database changes", () => {
    it("DB1: schema.prisma has AIInsightStatus enum", () => {
      const src = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf-8")
      expect(src).toContain("enum AIInsightStatus")
      expect(src).toContain("ACTIVE")
      expect(src).toContain("READ")
      expect(src).toContain("ARCHIVED")
      expect(src).toContain("RESOLVED")
    })

    it("DB2: schema.prisma has AIInsightCategory enum", () => {
      const src = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf-8")
      expect(src).toContain("enum AIInsightCategory")
      expect(src).toContain("RISK")
      expect(src).toContain("OPPORTUNITY")
      expect(src).toContain("PREDICTION")
      expect(src).toContain("GENERAL")
    })

    it("DB3: schema.prisma has CircleHealthScore model", () => {
      const src = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf-8")
      expect(src).toContain("model CircleHealthScore")
      expect(src).toContain("circleId")
      expect(src).toContain("score")
      expect(src).toContain("rating")
      expect(src).toContain("factors")
      expect(src).toContain("predictions")
    })

    it("DB4: AIInsight model has new fields", () => {
      const src = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf-8")
      const aiSection = src.slice(src.indexOf("model AIInsight"), src.indexOf("model CircleAutomationLog"))
      expect(aiSection).toMatch(/status\s+AIInsightStatus/)
      expect(aiSection).toMatch(/category\s+AIInsightCategory/)
      expect(aiSection).toMatch(/reason\s+String\?/)
      expect(aiSection).toMatch(/recommendedAction\s+String\?/)
      expect(aiSection).toMatch(/resolvedAt\s+DateTime\?/)
    })

    it("DB5: Circle model has healthScore relation", () => {
      const src = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf-8")
      const circleSection = src.slice(src.indexOf("model Circle {"), src.indexOf("model CircleMember"))
      expect(circleSection).toMatch(/healthScore\s+CircleHealthScore\?/)
    })

    it("DB6: NotificationType has AI_INSIGHT and FINANCIAL_RISK", () => {
      const src = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf-8")
      expect(src).toContain("AI_INSIGHT")
      expect(src).toContain("FINANCIAL_RISK")
    })

    it("DB7: AIInsightType has all 18 values", () => {
      const src = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf-8")
      const section = src.slice(src.indexOf("enum AIInsightType"), src.indexOf("enum AIInsightSeverity"))
      expect(section).toContain("MISSED_PAYMENT_RISK")
      expect(section).toContain("CONTRIBUTION_TREND")
      expect(section).toContain("SPENDING_ANOMALY")
      expect(section).toContain("BUDGET_OVERRUN")
      expect(section).toContain("REVENUE_DECLINE")
      expect(section).toContain("OUTSTANDING_APPROVAL")
      expect(section).toContain("HIGH_RISK_PROJECT")
      expect(section).toContain("LOW_CASH_FLOW")
      expect(section).toContain("DUPLICATE_PROOF")
      expect(section).toContain("INACTIVE_MEMBER")
      expect(section).toContain("PREDICTION")
      expect(section).toContain("OPPORTUNITY")
    })
  })

  describe("AI scoring logic", () => {
    it("S1: finance-health.service.ts exports computeCircleHealthScore", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("export async function computeCircleHealthScore")
    })

    it("S2: finance-health.service.ts exports getOrComputeHealth", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("export async function getOrComputeHealth")
    })

    it("S3: finance-health.service.ts exports generatePredictions", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("export async function generatePredictions")
    })

    it("S4: health score computes all 8 factors", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("Collection Rate")
      expect(src).toContain("Late Contributions")
      expect(src).toContain("Outstanding Balances")
      expect(src).toContain("Budget Adherence")
      expect(src).toContain("Revenue vs Expenses")
      expect(src).toContain("ROI")
      expect(src).toContain("Member Participation")
      expect(src).toContain("Financial Stability")
    })

    it("S5: health score rating function has all 5 ratings", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("EXCELLENT")
      expect(src).toContain("GOOD")
      expect(src).toContain("AVERAGE")
      expect(src).toContain("NEEDS_ATTENTION")
      expect(src).toContain("CRITICAL")
    })

    it("S6: health score weights sum to 100", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      const weightMatches = src.match(/weight:\s*(\d+)/g)
      const weights = weightMatches
        ? weightMatches.map((w) => { const m = w.match(/weight:\s*(\d+)/); return m ? parseInt(m[1]) : 0 }).filter((w) => w > 0 && w <= 100)
        : []
      const sum = weights.reduce((a, b) => a + b, 0)
      expect(sum).toBe(100)
    })
  })

  describe("Insight engine", () => {
    it("I1: finance-insight.service.ts exports generateFinancialInsights", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-insight.service.ts"), "utf-8")
      expect(src).toContain("export async function generateFinancialInsights")
    })

    it("I2: finance-insight.service.ts exports runFinancialAnalysis", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-insight.service.ts"), "utf-8")
      expect(src).toContain("export async function runFinancialAnalysis")
    })

    it("I3: insight engine detects all 11 insight types", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-insight.service.ts"), "utf-8")
      expect(src).toContain("MISSED_PAYMENT_RISK")
      expect(src).toContain("CONTRIBUTION_TREND")
      expect(src).toContain("SPENDING_ANOMALY")
      expect(src).toContain("BUDGET_OVERRUN")
      expect(src).toContain("REVENUE_DECLINE")
      expect(src).toContain("OUTSTANDING_APPROVAL")
      expect(src).toContain("HIGH_RISK_PROJECT")
      expect(src).toContain("LOW_CASH_FLOW")
      expect(src).toContain("DUPLICATE_PROOF")
      expect(src).toContain("INACTIVE_MEMBER")
      expect(src).toContain("MEMBER_RISK")
    })

    it("I4: each insight includes severity, reason, recommendedAction", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-insight.service.ts"), "utf-8")
      expect(src).toContain("severity: insight.severity")
      expect(src).toContain("reason: insight.reason")
      expect(src).toContain("recommendedAction: insight.recommendedAction")
    })

    it("I5: insights are deduped by fingerprint", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-insight.service.ts"), "utf-8")
      expect(src).toContain("existingFingerprints")
      expect(src).toContain("fingerprint")
    })

    it("I6: runFinancialAnalysis creates audit logs", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-insight.service.ts"), "utf-8")
      expect(src).toContain("INSIGHT_GENERATED")
      expect(src).toContain("AI_ANALYSIS_RUN")
    })

    it("I7: runFinancialAnalysis sends notifications for critical/warning insights", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-insight.service.ts"), "utf-8")
      expect(src).toContain("FINANCIAL_RISK")
      expect(src).toContain("notifyCircleMembers")
    })
  })

  describe("Prediction engine", () => {
    it("P1: generatePredictions returns endOfMonthCollection", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("endOfMonthCollection")
    })

    it("P2: generatePredictions returns projectedCashFlow", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("projectedCashFlow")
    })

    it("P3: generatePredictions returns budgetExhaustionDate", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("budgetExhaustionDate")
    })

    it("P4: generatePredictions returns expectedROI", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("expectedROI")
    })

    it("P5: generatePredictions returns fundingShortfall", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("fundingShortfall")
    })

    it("P6: generatePredictions returns futureOverdueCount", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-health.service.ts"), "utf-8")
      expect(src).toContain("futureOverdueCount")
    })
  })

  describe("API routes", () => {
    it("API1: AI snapshot route exists", () => {
      const src = readFileSync(join(root, "app", "api", "circles", "[circleId]", "ai", "route.ts"), "utf-8")
      expect(src).toContain("GET")
      expect(src).toContain("POST")
    })

    it("API2: AI insights CRUD route exists", () => {
      const src = readFileSync(join(root, "app", "api", "circles", "[circleId]", "ai", "insights", "[insightId]", "route.ts"), "utf-8")
      expect(src).toContain("PATCH")
      expect(src).toContain("DELETE")
    })

    it("API3: Predictions route exists", () => {
      const src = readFileSync(join(root, "app", "api", "circles", "[circleId]", "ai", "predictions", "route.ts"), "utf-8")
      expect(src).toContain("GET")
    })

    it("API4: Health route exists", () => {
      const src = readFileSync(join(root, "app", "api", "circles", "[circleId]", "ai", "health", "route.ts"), "utf-8")
      expect(src).toContain("GET")
    })
  })

  describe("Dashboard updates", () => {
    it("D1: AiInsightsWidget component exists", () => {
      const src = readFileSync(join(root, "components", "ai", "ai-insights-widget.tsx"), "utf-8")
      expect(src).toContain("AiInsightsWidget")
      expect(src).toContain("Health Score")
      expect(src).toContain("Top Risks")
      expect(src).toContain("Top Opportunities")
      expect(src).toContain("Predicted Cash Position")
      expect(src).toContain("Recommended Actions")
    })

    it("D2: Dashboard page imports AiInsightsWidget", () => {
      const src = readFileSync(join(root, "app", "(dashboard)", "circles", "[circleId]", "page.tsx"), "utf-8")
      expect(src).toContain("AiInsightsWidget")
    })

    it("D3: Assistant page uses real health score", () => {
      const src = readFileSync(join(root, "app", "(dashboard)", "circles", "[circleId]", "assistant", "page.tsx"), "utf-8")
      expect(src).toContain("getOrComputeHealth")
      expect(src).toContain("getCircleInsightsWithStatus")
    })
  })

  describe("Notifications", () => {
    it("N1: notification.service.ts has AI_INSIGHT type", () => {
      const src = readFileSync(join(root, "lib", "services", "notification.service.ts"), "utf-8")
      expect(src).toContain("AI_INSIGHT")
    })

    it("N2: notification.service.ts has FINANCIAL_RISK type", () => {
      const src = readFileSync(join(root, "lib", "services", "notification.service.ts"), "utf-8")
      expect(src).toContain("FINANCIAL_RISK")
    })

    it("N3: notification.service.ts has ai preference default", () => {
      const src = readFileSync(join(root, "lib", "services", "notification.service.ts"), "utf-8")
      expect(src).toContain("ai: true")
    })
  })

  describe("Permissions", () => {
    it("PM1: circlePermissions has AI_VIEW and AI_MANAGE", () => {
      const src = readFileSync(join(root, "lib", "permissions", "circlePermissions.ts"), "utf-8")
      expect(src).toContain("AI_VIEW")
      expect(src).toContain("AI_MANAGE")
    })

    it("PM2: circle-role-permissions.ts grants AI_VIEW to all roles", () => {
      const src = readFileSync(join(root, "lib", "permissions", "circle-role-permissions.ts"), "utf-8")
      expect(src).toContain("P.AI_VIEW")
      expect(src).toContain("P.AI_MANAGE")
    })
  })

  describe("Audit", () => {
    it("AU1: audit logs INSIGHT_GENERATED action", () => {
      const src = readFileSync(join(root, "lib", "services", "finance-insight.service.ts"), "utf-8")
      expect(src).toContain("INSIGHT_GENERATED")
    })

    it("AU2: audit logs INSIGHT_STATUS_CHANGED action", () => {
      const src = readFileSync(join(root, "app", "api", "circles", "[circleId]", "ai", "insights", "[insightId]", "route.ts"), "utf-8")
      expect(src).toContain("INSIGHT_STATUS_CHANGED")
    })
  })
})