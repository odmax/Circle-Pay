import { prisma } from "@/lib/prisma"
import { addProjectActivity } from "@/lib/services/project.service"

export async function createProjectAsset(projectId: string, circleId: string, userId: string, data: {
  name: string; type?: string; purchaseAmount?: number; currentValue?: number;
  notes?: string; custodianId?: string; location?: string;
  depreciationMethod?: string; depreciationRate?: number; depreciationStartDate?: Date;
  linkedExpenseId?: string
}) {
  const asset = await prisma.projectAsset.create({
    data: {
      projectId, circleId, createdById: userId, name: data.name,
      type: (data.type as any) || "OTHER",
      purchaseAmount: data.purchaseAmount || null,
      currentValue: data.currentValue || data.purchaseAmount || null,
      notes: data.notes || null,
      status: data.purchaseAmount ? "PURCHASED" : "PLANNED",
      custodianId: data.custodianId || null,
      location: data.location || null,
      depreciationMethod: data.depreciationMethod || null,
      depreciationRate: data.depreciationRate || null,
      depreciationStartDate: data.depreciationStartDate || null,
      accumulatedDepreciation: 0,
      linkedExpenseId: data.linkedExpenseId || null,
    },
  })
  await addProjectActivity(projectId, userId, "asset_created", `Asset "${data.name}" added`)
  if (data.purchaseAmount && data.purchaseAmount > 0) {
    try {
      const { recordInvestmentAssetToLedger } = await import("@/lib/services/wallet.service")
      await recordInvestmentAssetToLedger(circleId, `project-asset:${asset.id}`, data.purchaseAmount, userId)
    } catch {}
  }
  return asset
}

export async function markAssetSold(assetId: string, userId: string, saleValue: number) {
  const asset = await prisma.projectAsset.update({
    where: { id: assetId },
    data: { status: "SOLD", saleValue, soldAt: new Date() },
    include: { project: { select: { id: true } } },
  })
  await addProjectActivity(asset.project.id, userId, "asset_sold", `Asset "${asset.name}" sold for R${saleValue.toLocaleString()}`)
  return asset
}

export async function updateAssetValue(assetId: string, userId: string, currentValue: number) {
  const asset = await prisma.projectAsset.update({
    where: { id: assetId },
    data: { currentValue },
    include: { project: { select: { id: true } } },
  })
  await addProjectActivity(asset.project.id, userId, "asset_value_updated", `Asset "${asset.name}" value updated to R${currentValue.toLocaleString()}`)
  return asset
}

export async function calculateAssetDepreciation(assetId: string) {
  const asset = await prisma.projectAsset.findUnique({ where: { id: assetId } })
  if (!asset) throw new Error("Asset not found")
  if (!asset.depreciationMethod || asset.depreciationMethod === "NONE") return { asset, depreciation: 0, newCurrentValue: Number(asset.currentValue || 0) }
  if (!asset.depreciationStartDate || !asset.depreciationRate || !asset.purchaseAmount) {
    return { asset, depreciation: 0, newCurrentValue: Number(asset.currentValue || asset.purchaseAmount || 0) }
  }

  const purchaseAmount = Number(asset.purchaseAmount)
  const rate = Number(asset.depreciationRate)
  const startDate = new Date(asset.depreciationStartDate)
  const now = new Date()
  const monthsElapsed = Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()))
  const yearsElapsed = monthsElapsed / 12

  let depreciation = 0
  if (asset.depreciationMethod === "STRAIGHT_LINE") {
    // Annual depreciation = (Cost - Salvage) * Rate
    depreciation = purchaseAmount * rate * yearsElapsed
  } else if (asset.depreciationMethod === "DECLINING_BALANCE") {
    // Declining balance: Cost * (1 - (1 - rate)^years)
    depreciation = purchaseAmount * (1 - Math.pow(1 - rate, yearsElapsed))
  }

  depreciation = Math.min(depreciation, purchaseAmount) // Can't depreciate below 0
  const accumulatedDepreciation = Number(asset.accumulatedDepreciation || 0)
  const newAccumulated = accumulatedDepreciation + depreciation
  const newCurrentValue = Math.max(purchaseAmount - newAccumulated, 0)

  return { asset, depreciation, newCurrentValue, newAccumulated }
}

export async function createProjectRevenue(projectId: string, circleId: string, userId: string, data: {
  amount: number; type?: string; assetId?: string; description?: string;
  reference?: string; grossAmount?: number; directCosts?: number;
  invoiceUrl?: string; proofUrl?: string; status?: string
}) {
  const grossAmount = data.grossAmount || data.amount
  const directCosts = data.directCosts || 0
  const netAmount = grossAmount - directCosts

  if (netAmount < 0) throw new Error("Net amount cannot be negative (direct costs exceed gross)")

  const rev = await prisma.projectRevenue.create({
    data: {
      projectId, circleId, createdById: userId,
      grossAmount, directCosts, amount: netAmount,
      type: (data.type as any) || "OTHER",
      assetId: data.assetId || null,
      description: data.description || null,
      reference: data.reference || null,
      invoiceUrl: data.invoiceUrl || null,
      proofUrl: data.proofUrl || null,
      status: data.status || "CONFIRMED",
      revenueDate: new Date(),
    },
  })
  await addProjectActivity(projectId, userId, "revenue_recorded", `Revenue of R${netAmount.toLocaleString()} recorded (gross R${grossAmount.toLocaleString()}, costs R${directCosts.toLocaleString()})`)
  try {
    const { recordInvestmentReturnToLedger } = await import("@/lib/services/wallet.service")
    await recordInvestmentReturnToLedger(circleId, `project-revenue:${rev.id}`, netAmount, userId)
  } catch {}
  return rev
}

export async function approveProjectRevenue(revenueId: string, adminId: string) {
  const rev = await prisma.projectRevenue.findUnique({ where: { id: revenueId } })
  if (!rev) throw new Error("Revenue not found")
  if (rev.status !== "PENDING") throw new Error("Revenue is not pending")

  return prisma.projectRevenue.update({
    where: { id: revenueId },
    data: { status: "CONFIRMED", approvedById: adminId, approvedAt: new Date() },
  })
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
  const totalExpensesApproved = expenses.filter((e) => e.status === "APPROVED" || e.status === "PAID").reduce((s, e) => s + Number(e.amount), 0)
  const totalAssetPurchase = assets.filter((a) => a.status !== "PLANNED" && a.purchaseAmount).reduce((s, a) => s + Number(a.purchaseAmount || 0), 0)
  const totalCurrentAssetValue = assets.filter((a) => a.currentValue).reduce((s, a) => s + Number(a.currentValue || 0), 0)
  const totalSaleValue = assets.filter((a) => a.saleValue).reduce((s, a) => s + Number(a.saleValue || 0), 0)

  // Revenue: gross vs net
  const totalRevenueGross = revenues.reduce((s, r) => s + Number(r.grossAmount || r.amount), 0)
  const totalDirectCosts = revenues.reduce((s, r) => s + Number(r.directCosts || 0), 0)
  const totalRevenueNet = revenues.reduce((s, r) => s + Number(r.amount), 0)

  // ROI calculations (using net revenue)
  const grossProfit = totalRevenueNet + totalCurrentAssetValue - totalExpensesPaid
  const netProfit = totalRevenueNet + totalCurrentAssetValue - raised - totalExpensesPaid
  const roi = raised > 0 ? Math.round((netProfit / raised) * 100) : 0

  // Break-even point: total expenses / net revenue per period
  const breakEvenMonths = totalRevenueNet > 0 ? Math.ceil(totalExpensesPaid / (totalRevenueNet / Math.max(1, revenues.length))) : 0

  // Depreciation summary
  const totalDepreciation = assets.reduce((s, a) => s + Number(a.accumulatedDepreciation || 0), 0)

  return {
    summary: {
      raised, totalExpensesPaid, totalExpensesApproved,
      totalAssetPurchase, totalCurrentAssetValue, totalSaleValue,
      totalRevenueGross, totalDirectCosts, totalRevenueNet,
      grossProfit, netProfit, roi, breakEvenMonths, totalDepreciation,
    },
    assets: assets.map((a) => ({
      id: a.id, name: a.name, type: a.type, status: a.status,
      purchaseAmount: a.purchaseAmount ? Number(a.purchaseAmount) : null,
      currentValue: a.currentValue ? Number(a.currentValue) : null,
      saleValue: a.saleValue ? Number(a.saleValue) : null,
      depreciationMethod: a.depreciationMethod,
      depreciationRate: a.depreciationRate ? Number(a.depreciationRate) : null,
      accumulatedDepreciation: a.accumulatedDepreciation ? Number(a.accumulatedDepreciation) : 0,
      custodianId: a.custodianId,
      location: a.location,
    })),
    revenues: revenues.map((r) => ({
      id: r.id, grossAmount: Number(r.grossAmount || r.amount), directCosts: Number(r.directCosts || 0),
      amount: Number(r.amount), type: r.type, asset: r.asset?.name || null,
      description: r.description, date: r.revenueDate, status: r.status,
    })),
  }
}
