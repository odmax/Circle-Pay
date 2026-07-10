import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getJoinRequests } from "@/lib/services/join-request.service"
import { JoinRequestActions } from "@/components/circles/join-request-actions"

export default async function JoinRequestsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, requests
  try { [circle, requests] = await Promise.all([getCircleById(circleId, session.user.id), getJoinRequests(circleId, session.user.id)]) }
  catch { notFound() }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Join Requests</h1>
          <p className="text-muted-foreground">{circle.name} — {requests.length} request{requests.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-12 text-center"><p className="text-sm text-muted-foreground">No join requests</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const u = r.user
            const init = u.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??"
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-4">
                <Avatar className="size-10"><AvatarImage src={u.image || ""} /><AvatarFallback>{init}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {r.message && <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{r.message}&rdquo;</p>}
                  {r.answers && Object.keys(r.answers as Record<string, string>).length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {(Object.entries(r.answers as Record<string, string>)).map(([q, a]) => (
                        <div key={q} className="text-xs"><span className="text-muted-foreground">{q}:</span> <span className="font-medium">{a}</span></div>
                      ))}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className={r.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" : r.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>{r.status}</Badge>
                {r.status === "PENDING" && <JoinRequestActions circleId={circleId} requestId={r.id} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
