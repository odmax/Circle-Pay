import { prisma } from "@/lib/prisma"

export async function validatePromoCode(code: string, userId: string, planId: string) {
  const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } })
  if (!promo) return { valid: false, message: "Invalid promo code" }
  if (!promo.isActive) return { valid: false, message: "Promo code is no longer active" }

  const now = new Date()
  if (promo.startsAt && now < promo.startsAt) return { valid: false, message: "Promo code not yet active" }
  if (promo.endsAt && now > promo.endsAt) return { valid: false, message: "Promo code has expired" }

  if (promo.maxRedemptions && promo.redemptionCount >= promo.maxRedemptions) {
    return { valid: false, message: "Max redemptions reached" }
  }

  if (promo.appliesToPlanIds) {
    const plans = (promo.appliesToPlanIds as string[]) || []
    if (plans.length > 0 && !plans.includes(planId)) {
      return { valid: false, message: "Not applicable to this plan" }
    }
  }

  const alreadyRedeemed = await prisma.promoRedemption.findFirst({ where: { promoCodeId: promo.id, userId } })
  if (alreadyRedeemed) return { valid: false, message: "You have already used this code" }

  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) return { valid: false, message: "Plan not found" }

  const originalAmount = Number(plan.price)
  const discount = calculateDiscount(originalAmount, { discountType: promo.discountType, discountValue: Number(promo.discountValue) })
  const finalAmount = Math.max(0, originalAmount - discount)

  return {
    valid: true, promoId: promo.id, code: promo.code,
    originalAmount, discountAmount: discount, finalAmount,
    discountType: promo.discountType, discountValue: Number(promo.discountValue),
    message: `${promo.name} applied!`,
  }
}

export function calculateDiscount(amount: number, promo: { discountType: string; discountValue: number }) {
  switch (promo.discountType) {
    case "PERCENTAGE": return Math.round(amount * (Number(promo.discountValue) / 100) * 100) / 100
    case "FIXED_AMOUNT": return Number(promo.discountValue)
    case "FREE_TRIAL_DAYS": return amount // first month free = full discount
    default: return 0
  }
}

export async function redeemPromoCode(promoCodeId: string, userId: string, subscriptionId?: string, paymentId?: string) {
  const existing = await prisma.promoRedemption.findFirst({ where: { promoCodeId, paymentId } })
  if (existing) return existing

  const redemption = await prisma.promoRedemption.create({ data: { promoCodeId, userId, subscriptionId, paymentId } })
  await prisma.promoCode.update({ where: { id: promoCodeId }, data: { redemptionCount: { increment: 1 } } })
  return redemption
}
