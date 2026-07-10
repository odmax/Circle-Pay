import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getActiveLegalDocuments, getUserLegalAcceptanceStatus, recordLegalAcceptance, getRequiredLegalDocuments } from "@/lib/services/legal-acceptance.service"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const s = await auth()
  if (url.pathname.endsWith("/acceptance-status")) {
    if (!s?.user?.id) return NextResponse.json({ required: [], allAccepted: true })
    return NextResponse.json(await getUserLegalAcceptanceStatus(s.user.id))
  }
  if (url.pathname.endsWith("/required")) {
    return NextResponse.json(await getRequiredLegalDocuments())
  }
  return NextResponse.json(await getActiveLegalDocuments())
}

export async function POST(req: Request) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { slugs } = await req.json()
  if (!slugs || !Array.isArray(slugs)) return NextResponse.json({ error: "slugs required" }, { status: 400 })
  const headers = req.headers
  await recordLegalAcceptance(s.user.id, slugs, { ip: headers.get("x-forwarded-for") || undefined, userAgent: headers.get("user-agent") || undefined })
  return NextResponse.json({ ok: true })
}
