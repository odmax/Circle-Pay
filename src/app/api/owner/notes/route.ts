import { NextResponse } from "next/server"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { getOwnerNotes, createOwnerNote } from "@/lib/services/owner-permission.service"

export async function GET(req: Request) {
  try { await requireOwnerPage(PERMISSIONS.SUPPORT_MANAGE) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const url = new URL(req.url)
  const targetType = url.searchParams.get("targetType")
  const targetId = url.searchParams.get("targetId")
  if (!targetType || !targetId) return NextResponse.json({ error: "targetType and targetId required" }, { status: 400 })
  try { return NextResponse.json(await getOwnerNotes(targetType, targetId)) }
  catch { return NextResponse.json([]) }
}

export async function POST(req: Request) {
  let adminId: string
  try { adminId = await requireOwnerPage(PERMISSIONS.SUPPORT_MANAGE) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
  const { targetType, targetId, note } = await req.json()
  try { return NextResponse.json(await createOwnerNote(adminId!, targetType, targetId, note), { status: 201 }) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
