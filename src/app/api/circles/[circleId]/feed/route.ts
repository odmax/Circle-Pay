import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleFeed, createPost } from "@/lib/services/feed.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { hasFeature } = await import("@/lib/services/feature-gate.service")
  if (!await hasFeature(s.user.id, "COMMUNITY_FEED")) return NextResponse.json({ error: "Community feed is not available on your plan" }, { status: 403 })
  try {
    const { circleId } = await params
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get("limit") || "20")
    const cursor = url.searchParams.get("cursor") || undefined
    return NextResponse.json(await getCircleFeed(circleId, limit, cursor))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 403 }) }
}

export async function POST(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { hasFeature } = await import("@/lib/services/feature-gate.service")
  if (!await hasFeature(s.user.id, "COMMUNITY_FEED")) return NextResponse.json({ error: "Community feed is not available on your plan" }, { status: 403 })
  try {
    const { circleId } = await params
    const data = await req.json()
    return NextResponse.json(await createPost(circleId, s.user.id, data), { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
