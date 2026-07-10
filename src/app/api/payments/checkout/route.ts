import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDefaultProvider } from "@/lib/payments"
import { validatePromoCode } from "@/lib/services/promo.service"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  try {
    const body = await req.json()
    const { planSlug, promoCode } = body
    if (!planSlug) { return NextResponse.json({ error: "Plan slug required" }, { status: 400 }) }

    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } })
    if (!plan || !plan.isActive) { return NextResponse.json({ error: "Plan not available" }, { status: 400 }) }

    let finalAmount = Number(plan.price)
    let promoMeta: Record<string, unknown> | undefined

    if (promoCode && finalAmount > 0) {
      const validation = await validatePromoCode(promoCode, session.user.id, plan.id)
      if (!validation.valid) { return NextResponse.json({ error: validation.message }, { status: 400 }) }
      finalAmount = validation.finalAmount ?? finalAmount
      promoMeta = { promoCodeId: validation.promoId, promoCode: validation.code, originalAmount: validation.originalAmount, discountAmount: validation.discountAmount, finalAmount }
    }

    const merchantRef = `cp_${Date.now()}_${session.user.id.slice(0, 8)}`
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const transaction = await prisma.paymentTransaction.create({
      data: {
        userId: session.user.id, planId: plan.id, provider: "PAYFAST",
        merchantReference: merchantRef, amount: finalAmount, currency: plan.currency,
        status: "PENDING",       metadata: promoMeta as any,
      },
    })

    const provider = getDefaultProvider()
    const checkoutUrl = await provider.createCheckoutUrl({
      merchantReference: merchantRef, amount: finalAmount,
      itemName: `Circle Pay — ${plan.name} Plan`,
      itemDescription: promoCode ? `${plan.name} (promo: ${promoCode})` : `${plan.name} subscription`,
      returnUrl: `${baseUrl}/billing/success`, cancelUrl: `${baseUrl}/billing/cancel`,
      notifyUrl: `${baseUrl}/api/payments/payfast/notify`,
      email: session.user.email || undefined,
      nameFirst: session.user.name?.split(" ")[0] || undefined,
      nameLast: session.user.name?.split(" ").slice(1).join(" ") || undefined,
    })

    return NextResponse.json({ checkoutUrl, transactionId: transaction.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 500 })
  }
}
