import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPaymentProvider } from "@/lib/payments"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const data: Record<string, string> = {}
    formData.forEach((v, k) => { data[k] = v.toString() })

    const provider = getPaymentProvider("payfast")

    if (!provider.verifySignature(data)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const merchantReference = data.m_payment_id
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { merchantReference },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (transaction.status === "PAID") {
      return NextResponse.json({ status: "Already processed" })
    }

    if (!provider.validatePayment(data, Number(transaction.amount))) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED", failedAt: new Date(), metadata: { itnData: data } },
      })
      return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }

    // Mark transaction paid
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "PAID",
        providerReference: data.pf_payment_id || null,
        paidAt: new Date(),
        metadata: { itnData: data },
      },
    })

    // Activate subscription
    const now = new Date()
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())

    const existingSub = await prisma.userSubscription.findUnique({
      where: { userId: transaction.userId },
    })

    if (existingSub) {
      await prisma.userSubscription.update({
        where: { userId: transaction.userId },
        data: {
          planId: transaction.planId,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
        },
      })
    } else {
      await prisma.userSubscription.create({
        data: {
          userId: transaction.userId,
          planId: transaction.planId,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      })
    }

    // Link transaction to subscription
    const sub = await prisma.userSubscription.findUnique({ where: { userId: transaction.userId } })
    if (sub) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { subscriptionId: sub.id },
      })
    }

    // Redeem promo code if applicable
    try {
      const tx = await prisma.paymentTransaction.findUnique({ where: { id: transaction.id } })
      const meta = tx?.metadata as Record<string, unknown> | null
      if (meta?.promoCodeId) {
        const { redeemPromoCode } = await import("@/lib/services/promo.service")
        await redeemPromoCode(meta.promoCodeId as string, transaction.userId, sub?.id, transaction.id)
      }
    } catch {}

    return NextResponse.json({ status: "Payment processed successfully" })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "ITN processing failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
