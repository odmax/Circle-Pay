"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarCheck, FileText, Lock, Play, RefreshCw, Send, CheckCircle2, AlertTriangle, LockOpen } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export interface YearEndPermissions {
  canView: boolean
  canManage: boolean
  canApprove: boolean
  canAdjust: boolean
}

interface YearEndClientProps {
  circleId: string
  userId: string
  symbol: string
  permissions: YearEndPermissions
}

interface CloseItem {
  id: string
  periodStart: string
  periodEnd: string
  status: string
  summary?: unknown
  blockers?: { blockers?: { code: string; message: string }[]; clear?: boolean } | null
  finalizedAt: string | null
  createdAt: string
}

interface StatusData {
  hasClose: boolean
  status: string | null
  statusIndex: number
  totalSteps: number
  periodEnd: string | null
  finalizedAt: string | null
  statementsGenerated: number
  myStatement: {
    statementNumber: string
    periodEnd: string
    totalContributed: string
    finalEntitlement: string
  } | null
  blockerCodes: string[]
  clear: boolean
}

const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  RECONCILING: "Reconciling",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  FINALIZED: "Finalized",
  REOPENED: "Reopened (corrections)",
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Request failed")
  }
  return data
}

export function YearEndClient({ circleId, userId, symbol, permissions }: YearEndClientProps) {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [closes, setCloses] = useState<CloseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, closesRes] = await Promise.all([
        fetch(`/api/circles/${circleId}/year-end/status`).then((r) => r.json()),
        fetch(`/api/circles/${circleId}/year-end`).then((r) => r.json()),
      ])
      setStatus(statusRes)
      setCloses(closesRes.closes ?? [])
    } catch {
      toast.error("Failed to load year-end data")
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    load()
  }, [load])

  const act = async (name: string, url: string) => {
    setBusy(name)
    try {
      await post(url)
      toast.success(`Year-end ${name} successful`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const activeClose =
    closes.length > 0 ? closes[0] : null

  const { canManage, canApprove: permApprove, canAdjust } = permissions

  // Status gating (server-permission independent) — what the workflow allows right now.
  const noClose = !status?.hasClose
  const statusAllowsReconcile = !!activeClose && ["DRAFT", "RECONCILING", "REOPENED"].includes(activeClose.status)
  const statusAllowsSubmit = !!activeClose && ["DRAFT", "RECONCILING", "REOPENED"].includes(activeClose.status)
  const statusAllowsApprove = !!activeClose && activeClose.status === "PENDING_APPROVAL"
  const statusAllowsFinalize = !!activeClose && (activeClose.status === "APPROVED" || activeClose.status === "PENDING_APPROVAL")
  const statusAllowsReopen = !!activeClose && activeClose.status === "FINALIZED"

  // Permission + status gating — the button set the user actually sees.
  const canReconcile = statusAllowsReconcile && canManage
  const canSubmit = statusAllowsSubmit && canManage
  const canApprove = statusAllowsApprove && permApprove
  const canFinalize = statusAllowsFinalize && canManage
  const canReopen = statusAllowsReopen && canAdjust

  // Read-only signals shown when the workflow would allow an action but the
  // user lacks the permission — instead of rendering a button that 403s.
  const isManagedByOthers =
    !!activeClose &&
    !noClose &&
    (
      (statusAllowsReconcile && !canManage) ||
      (statusAllowsSubmit && !canManage) ||
      (statusAllowsApprove && !permApprove) ||
      (statusAllowsFinalize && !canManage) ||
      (statusAllowsReopen && !canAdjust)
    )

  const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : "—")

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="size-4 text-muted-foreground" /> Year-End Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !status?.hasClose ? (
            canManage ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No year-end close has been initiated. Start the financial year-end close workflow to reconcile, approve and lock the period.
                </p>
                <Button
                  onClick={() => act("initiate", `/api/circles/${circleId}/year-end`)}
                  disabled={busy !== null}
                >
                  <Play className="size-4 mr-1.5" /> Initiate close
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
                No year-end close has been initiated. Authorized members will begin the close workflow when ready.
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize">{LABELS[status.status ?? ""] ?? status.status}</span>
                <span className="text-xs text-muted-foreground">
                  Period ends {fmt(status.periodEnd)}
                </span>
              </div>

              <div className="flex gap-1">
                {Array.from({ length: status.totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= status.statusIndex ? "bg-emerald-500" : "bg-border"
                    }`}
                  />
                ))}
              </div>

              {status.blockerCodes.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-600">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Open blockers: {status.blockerCodes.join(", ")}</span>
                </div>
              )}

              {isManagedByOthers && (
                <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5 inline mr-1.5" />
                  Read-only — the next step requires authorized members (treasurer or admin).
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {activeClose && canReconcile && (
                  <Button variant="outline" onClick={() => act("reconcile", `/api/circles/${circleId}/year-end/${activeClose.id}/reconcile`)} disabled={busy !== null}>
                    <RefreshCw className="size-4 mr-1.5" /> Reconcile
                  </Button>
                )}
                {activeClose && canSubmit && (
                  <Button variant="outline" onClick={() => act("submit", `/api/circles/${circleId}/year-end/${activeClose.id}/submit`)} disabled={busy !== null}>
                    <Send className="size-4 mr-1.5" /> Submit for approval
                  </Button>
                )}
                {activeClose && canApprove && (
                  <Button variant="outline" onClick={() => act("approve", `/api/circles/${circleId}/year-end/${activeClose.id}/approve`)} disabled={busy !== null}>
                    <CheckCircle2 className="size-4 mr-1.5" /> Approve
                  </Button>
                )}
                {activeClose && canFinalize && (
                  <Button onClick={() => act("finalize", `/api/circles/${circleId}/year-end/${activeClose.id}/finalize`)} disabled={busy !== null}>
                    <Lock className="size-4 mr-1.5" /> Finalize & lock
                  </Button>
                )}
                {activeClose && canReopen && (
                  <Button variant="outline" onClick={() => act("reopen", `/api/circles/${circleId}/year-end/${activeClose.id}/reopen`)} disabled={busy !== null}>
                    <LockOpen className="size-4 mr-1.5" /> Reopen (audited)
                  </Button>
                )}
              </div>

              {status.myStatement && (
                <div className="rounded-xl border border-border/60 p-3 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="size-4 text-muted-foreground" /> {status.myStatement.statementNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Period ending {fmt(status.myStatement.periodEnd)} · Contributed {symbol}{status.myStatement.totalContributed} · Net entitlement {symbol}{status.myStatement.finalEntitlement}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {closes.length > 0 && (
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-base">Close History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {closes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm"
              >
                <div>
                  <p className="font-medium capitalize">{LABELS[c.status] ?? c.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(c.periodStart)} → {fmt(c.periodEnd)}
                  </p>
                </div>
                {c.finalizedAt && (
                  <span className="text-xs text-emerald-600">Finalized {fmt(c.finalizedAt)}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
