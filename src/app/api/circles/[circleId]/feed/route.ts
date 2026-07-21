import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCircleFeed, createPost } from "@/lib/services/feed.service"

export async function GET(req: Request, { params }: { params: Promise<{ circleId: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
  try {
    const { circleId } = await params
    const data = await req.json()
    const post = await createPost(circleId, s.user.id, data)

    // Notify all circle members about the new post
    const { notifyCircleMembers } = await import("@/lib/services/notification.service")
    notifyCircleMembers(circleId, s.user.id, {
      type: "FEED_POST_CREATED",
      title: `New post from ${post.author.name || "a member"}`,
      message: post.content.slice(0, 120),
      link: `/circles/${circleId}/feed`,
    }).catch(() => {})

    return NextResponse.json(post, { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
