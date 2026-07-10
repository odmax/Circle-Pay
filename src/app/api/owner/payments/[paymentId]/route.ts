import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireOwnerPermission } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

async function checkAdmin(): Promise<string> { const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized"); await requireOwnerPermission(s.user.id, PERMISSIONS.PAYMENTS_EDIT); return s.user.id }

export async function PATCH(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  try { await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  try {
    const { paymentId } = await params
    const { status } = await req.json()
    const data: Record<string, unknown> = { status }
    if (status === "PAID") data.paidAt = new Date()
    if (status === "FAILED") data.failedAt = new Date()
    const tx = await prisma.paymentTransaction.update({ where: { id: paymentId }, data: data as any, include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } } })
    return NextResponse.json(tx)
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}

export async function POST(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  let userId: string
  try { userId = await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  try {
    const { paymentId } = await params
    const tx = await prisma.paymentTransaction.update({ where: { id: paymentId }, data: { metadata: { reviewedAt: new Date().toISOString(), reviewedBy: userId } as any }, include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } } })
    return NextResponse.json(tx)
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
