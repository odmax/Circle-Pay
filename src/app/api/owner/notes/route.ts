import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOwnerNotes, createOwnerNote } from "@/lib/services/owner-permission.service"

async function checkAdmin() {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  const admin = await prisma.internalAdmin.findUnique({ where: { userId: s.user.id } })
  if (!admin?.isActive) throw new Error("Forbidden")
  return s.user.id
}

export async function GET(req: Request) {
  try { await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const url = new URL(req.url)
  const targetType = url.searchParams.get("targetType")
  const targetId = url.searchParams.get("targetId")
  if (!targetType || !targetId) return NextResponse.json({ error: "targetType and targetId required" }, { status: 400 })
  try { return NextResponse.json(await getOwnerNotes(targetType, targetId)) }
  catch { return NextResponse.json([]) }
}

export async function POST(req: Request) {
  let adminId: string
  try { adminId = await checkAdmin() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const { targetType, targetId, note } = await req.json()
  try { return NextResponse.json(await createOwnerNote(adminId!, targetType, targetId, note), { status: 201 }) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
