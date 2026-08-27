import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ScrollText, FileText, Users, AlertTriangle, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { auth } from "@/lib/auth"
import { getCircleById } from "@/lib/services/circle.service"
import {
  getConstitutionOverview,
  listVersionSummaries,
  listAcceptances,
  getConflicts,
} from "@/lib/services/constitution.service"
import { getEnforcementSummary } from "@/lib/services/constitution-rules.service"
import {
  AcceptConstitutionButton,
  PublishActivateActions,
  NewDraftDialog,
} from "@/components/constitution/constitution-actions"
import { AmendDialog, ReviewAmendmentButtons, ResolveConflictDialog } from "@/components/constitution/constitution-forms"
import { prisma } from "@/lib/prisma"

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  PUBLISHED: "bg-amber-100 text-amber-700 border-amber-200",
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SUPERSEDED: "bg-muted text-muted-foreground border-border",
}

export default async function ConstitutionPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { circleId } = await params

  const circle = await getCircleById(circleId, session.user.id)
  if (!circle) notFound()

  let overview
  try {
    overview = await getConstitutionOverview(circleId, session.user.id)
  } catch {
    notFound()
  }

  if (!overview.exists) {
    // Members can view an empty state; only let it render for members.
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Card className="rounded-2xl border-border/40">
          <CardContent className="space-y-4 py-10 text-center">
            <ScrollText className="mx-auto size-10 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold">No constitution yet</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                This circle has not established a governing constitution. Owners can draft and activate one.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const versions = await listVersionSummaries(circleId, session.user.id)
  const canViewAcceptances = overview.permissions.canAcceptanceView
  const [acceptances, amendments, conflicts, rules] = await Promise.all([
    canViewAcceptances ? listAcceptances(circleId, session.user.id) : Promise.resolve([]),
    prisma.constitutionAmendment.findMany({
      where: { circleId },
      orderBy: { createdAt: "desc" },
      include: { proposer: { select: { id: true, name: true, email: true, image: true } } },
    }),
    getConflicts(circleId, session.user.id),
    getEnforcementSummary(circleId),
  ])

  const active = overview.active
  const activeVersion = active
    ? activeVersionFromList(versions, active.id)
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}`} />} variant="outline" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{overview.title}</h1>
          <p className="text-muted-foreground">{circle.name}</p>
        </div>
        {overview.permissions.canManage && (
          <NewDraftDialog circleId={circleId} title={overview.title} preamble={overview.preamble} />
        )}
      </div>

      {overview.preamble && (
        <Card className="rounded-2xl border-border/40">
          <CardContent className="pt-6 text-sm text-muted-foreground italic">{overview.preamble}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-border/40">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Status</div>
            {active ? (
              <Badge className={`mt-1 ${STATUS_STYLES[active.status] ?? ""}`}>{active.status}</Badge>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">None</div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Active Version</div>
            <div className="mt-1 text-2xl font-bold">v{active?.version ?? "—"}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><Users className="size-3.5" /> Acceptance</div>
            <div className="mt-1 text-2xl font-bold">{overview.percentage}%</div>
            <div className="text-xs text-muted-foreground">{overview.acceptedCount}/{overview.memberCount} members</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="size-3.5" /> Rule Conflicts</div>
            <div className={`mt-1 text-2xl font-bold ${overview.conflictCount > 0 ? "text-amber-600" : ""}`}>{overview.conflictCount}</div>
          </CardContent>
        </Card>
      </div>

      {overview.conflictCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          There are {overview.conflictCount} unresolved conflict{overview.conflictCount > 1 ? "s" : ""} between the constitution and circle settings. Review below.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><ScrollText className="size-4 text-muted-foreground" /> Clauses</CardTitle>
              {active && (
                <div className="flex items-center gap-2">
                  <PublishActivateActions circleId={circleId} versionId={active.id} status={active.status} canPublish={overview.permissions.canPublish} />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {overview.clauses.length === 0 && (
                <p className="text-sm text-muted-foreground">No clauses have been added to the active version yet.</p>
              )}
              {overview.clauses.map((clause) => (
                <div key={clause.key} className="rounded-xl border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase">{clause.category}</div>
                      <h3 className="font-medium">{clause.title}</h3>
                    </div>
                    {active && (
                      <AmendDialog
                        circleId={circleId}
                        versionId={active.id}
                        clauseKey={clause.key}
                        clauseTitle={clause.title}
                        canAmend={overview.permissions.canAmend}
                      />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{clause.text}</p>
                  {Object.keys(clause.rules ?? {}).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(clause.rules ?? {}).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="font-mono text-[11px]">
                          {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="size-4 text-muted-foreground" /> Versions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {versions.length === 0 && <p className="text-sm text-muted-foreground">No versions yet.</p>}
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    <Badge className={`ml-2 ${STATUS_STYLES[v.status] ?? ""}`}>{v.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {v._count.acceptances} accepted · {v.createdAt.toLocaleDateString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {active && (
            <Card className="rounded-2xl border-border/40">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Your Acceptance</CardTitle>
                {active.status === "ACTIVE" && (
                  <AcceptConstitutionButton circleId={circleId} versionId={active.id} accepted={!!overview.myAcceptance} />
                )}
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {overview.myAcceptance
                  ? `Accepted on ${new Date(overview.myAcceptance).toLocaleDateString()}`
                  : active.status === "ACTIVE"
                    ? "Review and accept the current constitution to confirm your agreement."
                    : "Waiting for this version to be activated."}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Scale className="size-4 text-muted-foreground" /> Enforced Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <RuleRow label="Contributions" value={rules.contribution.enabled ? `Min ${rules.contribution.amount ?? "—"} · Grace ${rules.contribution.gracePeriodDays ?? 0}d` : "Not enforced"} />
              <RuleRow label="Payouts" value={rules.payout.enabled ? (rules.payout.requiresApproval ? "Approval required" : "Rotation enforced") : "Not enforced"} />
              <RuleRow label="Voting" value={rules.voting.enabled ? `Quorum ${rules.voting.quorumPercent ?? 50}% · Pass ${rules.voting.thresholdPercent ?? 50}%` : "Not enforced"} />
              <RuleRow label="Membership" value={rules.membership.enabled ? `Exit notice ${rules.membership.exitNoticeDays ?? 0}d` : "Not enforced"} />
            </CardContent>
          </Card>

          {amendments.length > 0 && (
            <Card className="rounded-2xl border-border/40">
              <CardHeader>
                <CardTitle className="text-base">Amendments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {amendments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-border/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.clauseKey}</span>
                      <Badge variant="outline">{a.status}</Badge>
                    </div>
                    {a.reason && <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>}
                    <ReviewAmendmentButtons circleId={circleId} amendment={a} canAmend={overview.permissions.canAmend} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {conflicts.length > 0 && (
            <Card className="rounded-2xl border-border/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /> Conflicts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {conflicts.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{c.ruleKey}</span>
                      <Badge variant={c.status === "RESOLVED" ? "outline" : "secondary"}>{c.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">vs setting {c.settingKey}</p>
                    <ResolveConflictDialog circleId={circleId} conflict={c} canResolve={overview.permissions.canResolve} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {canViewAcceptances && acceptances.length > 0 && (
            <Card className="rounded-2xl border-border/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Users className="size-4 text-muted-foreground" /> Acceptances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {acceptances.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{m.name}</span>
                    </div>
                    {m.accepted ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Accepted</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function activeVersionFromList(versions: Awaited<ReturnType<typeof listVersionSummaries>>, id: string) {
  return versions.find((v) => v.id === id) ?? null
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
