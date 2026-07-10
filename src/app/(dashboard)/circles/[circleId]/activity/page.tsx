import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { getCircleAuditLogs } from "@/lib/services/audit.service"

const actionIcons: Record<string, string> = {
  created: "➕", updated: "✏️", deleted: "🗑️", added: "👋", removed: "🚫",
  contributed: "💰", allocated: "📥", completed: "🏆", confirmed: "✅", rejected: "❌",
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  let circle, logs
  try {
    ;[circle, logs] = await Promise.all([
      getCircleById(circleId, session.user.id),
      getCircleAuditLogs(circleId, session.user.id),
    ])
  } catch { notFound() }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-muted-foreground">Actions in this circle will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const user = log.user
            const initials = user?.name
              ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
              : "??"
            return (
              <div key={log.id} className="flex items-start gap-3 rounded-xl border border-border/40 bg-card p-3">
                <span className="text-lg mt-0.5">{actionIcons[log.action] || "📌"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{user?.name || "System"}</span>{" "}
                    <span className="text-muted-foreground">{log.action}</span>{" "}
                    <span>{log.entityType.toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleDateString()} · {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {user && (
                  <Avatar className="size-7">
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
