import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Zap, Power, PowerOff, Play, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import { ensureDefaultAutomations, getCircleAutomations } from "@/lib/services/automation.service"

export default async function AutomationsPage({ params }: { params: Promise<{ circleId: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login")
  const { circleId } = await params
  let circle
  try { circle = await getCircleById(circleId, session.user.id) } catch { notFound() }
  await ensureDefaultAutomations(circleId)
  const automations = await getCircleAutomations(circleId)
  const isAdmin = circle.userRole === "OWNER" || circle.userRole === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}/operations`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">Automations</h1><p className="text-muted-foreground">{circle.name} — {automations.length} rules</p></div>
      </div>

      {automations.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-12 text-center"><Zap className="size-10 text-muted-foreground/30 mb-3" /><p className="text-sm font-medium">No automation rules</p><p className="text-xs text-muted-foreground mt-1">Default automations are configured for each circle type.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {automations.map((rule) => (
            <Card key={rule.id} className={`rounded-2xl ${!rule.isEnabled ? "opacity-60" : ""}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 items-center justify-center rounded-lg ${rule.isEnabled ? "bg-brand-50 text-brand-700" : "bg-muted text-muted-foreground"}`}><Zap className="size-4" /></div>
                  <div>
                    <p className="text-sm font-medium">{rule.name}</p>
                    <div className="flex gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{rule.type.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className="text-[10px]">{rule.triggerType.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className="text-[10px]">{rule.actionType.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Last: {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleDateString() : "Never"} · Next: {rule.nextRunAt ? new Date(rule.nextRunAt).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <>
                      <form action={async () => { "use server"; const { prisma } = await import("@/lib/prisma"); await prisma.circleAutomationRule.update({ where: { id: rule.id }, data: { isEnabled: !rule.isEnabled } }) }}>
                        <Button type="submit" variant="ghost" size="sm" className="h-8 text-xs rounded-xl">{rule.isEnabled ? <PowerOff className="size-3 text-red-500" /> : <Power className="size-3 text-emerald-500" />}</Button>
                      </form>
                      <form action={async () => { "use server"; const { runAutomationRule } = await import("@/lib/services/automation.service"); await runAutomationRule(rule.id) }}>
                        <Button type="submit" variant="ghost" size="sm" className="h-8 text-xs rounded-xl"><Play className="size-3" /></Button>
                      </form>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
