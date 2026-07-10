import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserPaymentIntents, getCirclePaymentIntents, generateMonthlyPaymentIntents, submitProofOfPayment, confirmPaymentIntent, rejectPaymentIntent } from "@/lib/services/circle-payment.service"

async function handle(req: Request, { params }: { params: Promise<{ circleId: string; paymentIntentId?: string }> }, action: string) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, paymentIntentId } = await params

  // View payment intents (member-level)
  if (action === "my") return NextResponse.json(await getUserPaymentIntents(s.user.id, circleId))

  // View all payment intents (admin-level)
  if (action === "all") {
    const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
    if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })
    return NextResponse.json(await getCirclePaymentIntents(circleId))
  }

  if (action === "generate") {
    const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await generateMonthlyPaymentIntents(circleId, s.user.id))
  }

  if (!paymentIntentId) return NextResponse.json({ error: "Missing payment intent ID" }, { status: 400 })

  if (action === "proof") {
    const { proofReference, proofUrl } = await req.json()
    return NextResponse.json(await submitProofOfPayment(paymentIntentId, s.user.id, proofReference || "", proofUrl))
  }
  if (action === "confirm") {
    const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await confirmPaymentIntent(paymentIntentId, s.user.id))
  }
  if (action === "reject") {
    const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId, userId: s.user.id } } })
    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await rejectPaymentIntent(paymentIntentId, s.user.id))
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

export const GET = (req: Request, ctx: { params: Promise<{ circleId: string }> }) => handle(req, ctx as any, new URL(req.url).searchParams.get("view") === "all" ? "all" : "my")
export const POST = async (req: Request, ctx: { params: Promise<{ circleId: string; paymentIntentId?: string }> }) => {
  const action = new URL(req.url).pathname.includes("/generate") ? "generate" : new URL(req.url).pathname.includes("/proof") ? "proof" : new URL(req.url).pathname.includes("/confirm") ? "confirm" : new URL(req.url).pathname.includes("/reject") ? "reject" : "my"
  return handle(req, ctx, action)
}
