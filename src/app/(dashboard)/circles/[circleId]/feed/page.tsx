import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Pin, Heart, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleFeed } from "@/lib/services/feed.service"
import { CreateFeedPost } from "@/components/feed/create-feed-post"
import { FeedLoadMore } from "@/components/feed/feed-load-more"
import { FeedAutoRefresh } from "@/components/feed/feed-auto-refresh"

export default async function FeedPage({ params, searchParams }: { params: Promise<{ circleId: string }>; searchParams: Promise<{ cursor?: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  const sp = await searchParams

  let circle, feedData
  try { [circle, feedData] = await Promise.all([getCircleById(circleId, session.user.id), getCircleFeed(circleId, 20, sp.cursor)]) }
  catch { notFound() }

  const { posts, nextCursor, hasMore } = feedData

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Feed</h1><p className="text-muted-foreground">{circle.name}</p></div>
      </div>

      <FeedAutoRefresh />
      <CreateFeedPost circleId={circleId} />

      {posts.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><MessageCircle className="size-10 text-muted-foreground/50 mb-3" /><p className="font-medium">Your community starts here</p><p className="text-sm text-muted-foreground">Posts, contributions, and achievements will appear here</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const author = post.author
            const init = author.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"
            const typeColors: Record<string, string> = { ANNOUNCEMENT: "border-brand-200 bg-brand-50 text-brand-700", SYSTEM: "border-slate-200 bg-slate-50 text-slate-600", CONTRIBUTION: "border-emerald-200 bg-emerald-50 text-emerald-700", GOAL: "border-blue-200 bg-blue-50 text-blue-700", PAYOUT: "border-violet-200 bg-violet-50 text-violet-700" }
            const reactionSummary = post.reactions.reduce((acc: Record<string, number>, r: { emoji: string }) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc }, {})
            return (
              <Card key={post.id} className={`rounded-2xl ${post.isPinned ? "border-brand-200 bg-brand-50/10" : "border-border/40"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10"><AvatarImage src={author.image || ""} /><AvatarFallback>{init}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{author.name || author.email}</span>
                        {post.isPinned && <Pin className="size-3 text-brand" />}
                        <Badge variant="outline" className={`text-[10px] ${typeColors[post.type] || ""}`}>{post.type}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                      {post.title && <p className="font-medium mt-1">{post.title}</p>}
                      <p className="text-sm mt-1 whitespace-pre-wrap">{post.content}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Heart className="size-3" /> {Object.keys(reactionSummary).map((e) => reactionSummary[e] > 0 ? `${e} ${reactionSummary[e]}` : "").filter(Boolean).join(", ") || ""}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="size-3" /> {post._count.comments}</span>
                        {post._count.reactions > 0 && <span>{post._count.reactions}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      {hasMore && nextCursor && <FeedLoadMore circleId={circleId} cursor={nextCursor} />}
    </div>
  )
}
