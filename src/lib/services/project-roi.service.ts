import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

export async function createProjectAsset(projectId: string, circleId: string, userId: string, data: { name: string; type?: string; purchaseAmount?: number; currentValue?: number; notes?: string }) {
  const asset = await prisma.projectAsset.create({
    data: { projectId, circleId, createdById: userId, name: data.name, type: (data.type as any) || "OTHER", purchaseAmount: data.purchaseAmount || null, currentValue: data.currentValue || data.purchaseAmount || null, notes: data.notes || null, status: data.purchaseAmount ? "PURCHASED" : "PLANNED" },
  })
  await addProjectActivity(projectId, userId, "asset_created", `Asset "${data.name}" added`)
  // Wire ledger if purchase amount > 0
  if (data.purchaseAmount && data.purchaseAmount > 0) {
    try {
      const { recordInvestmentAssetToLedger } = await import("@/lib/services/wallet.service")
      await recordInvestmentAssetToLedger(circleId, `project-asset:${asset.id}`, data.purchaseAmount, userId)
    } catch {}
  }
  return asset
}

export async function markAssetSold(assetId: string, userId: string, saleValue: number) {
  const asset = await prisma.projectAsset.update({ where: { id: assetId }, data: { status: "SOLD", saleValue, soldAt: new Date() }, include: { project: { select: { id: true } } } })
  await addProjectActivity(asset.project.id, userId, "asset_sold", `Asset "${asset.name}" sold for R${saleValue.toLocaleString()}`)
  return asset
}

export async function createProjectRevenue(projectId: string, circleId: string, userId: string, data: { amount: number; type?: string; assetId?: string; description?: string; reference?: string }) {
  const rev = await prisma.projectRevenue.create({ data: { projectId, circleId, createdById: userId, amount: data.amount, type: (data.type as any) || "OTHER", assetId: data.assetId || null, description: data.description || null, reference: data.reference || null, revenueDate: new Date() } })
  await addProjectActivity(projectId, userId, "revenue_recorded", `Revenue of R${Number(rev.amount).toLocaleString()} recorded`)
  // Wire ledger
  try {
    const { recordInvestmentReturnToLedger } = await import("@/lib/services/wallet.service")
    await recordInvestmentReturnToLedger(circleId, `project-revenue:${rev.id}`, data.amount, userId)
  } catch {}
  return rev
}

export async function getProjectROIDashboard(projectId: string) {
  const [project, expenses, assets, revenues] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { currentAmount: true } }),
    prisma.projectExpense.findMany({ where: { projectId } }),
    prisma.projectAsset.findMany({ where: { projectId } }),
    prisma.projectRevenue.findMany({ where: { projectId }, include: { asset: { select: { name: true } } } }),
  ])

  const raised = Number(project?.currentAmount || 0)
  const totalExpensesPaid = expenses.filter((e) => e.status === "PAID").reduce((s, e) => s + Number(e.amount), 0)
  const totalAssetPurchase = assets.filter((a) => a.status !== "PLANNED" && a.purchaseAmount).reduce((s, a) => s + Number(a.purchaseAmount || 0), 0)
  const totalCurrentAssetValue = assets.filter((a) => a.currentValue).reduce((s, a) => s + Number(a.currentValue || 0), 0)
  const totalSaleValue = assets.filter((a) => a.saleValue).reduce((s, a) => s + Number(a.saleValue || 0), 0)
  const totalRevenue = revenues.reduce((s, r) => s + Number(r.amount), 0)
  const grossProfit = totalRevenue + totalCurrentAssetValue - totalExpensesPaid
  const netProfit = totalRevenue + totalCurrentAssetValue - raised - totalExpensesPaid
  const roi = raised > 0 ? Math.round((netProfit / raised) * 100) : 0

  return {
    summary: { raised, totalExpensesPaid, totalAssetPurchase, totalCurrentAssetValue, totalSaleValue, totalRevenue, grossProfit, netProfit, roi },
    assets: assets.map((a) => ({ id: a.id, name: a.name, type: a.type, status: a.status, purchaseAmount: a.purchaseAmount ? Number(a.purchaseAmount) : null, currentValue: a.currentValue ? Number(a.currentValue) : null, saleValue: a.saleValue ? Number(a.saleValue) : null })),
    revenues: revenues.map((r) => ({ id: r.id, amount: Number(r.amount), type: r.type, asset: r.asset?.name || null, description: r.description, date: r.revenueDate })),
  }
}
