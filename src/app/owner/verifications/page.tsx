import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShieldCheck, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  await requireOwnerPage(PERMISSIONS.VERIFICATIONS_MANAGE)
  const filter = params.status || "PENDING"
  const where: Record<string, unknown> = filter !== "ALL" ? { status: filter } : {}

  try {
    if (filter === "PUBLIC_NOT_VERIFIED") {
      const items = await prisma.circle.findMany({
        where: { visibility: "PUBLIC", isActive: true, verification: null },
        include: { _count: { select: { members: true } }, reputation: true, createdBy: { select: { name: true, email: true } } },
        take: 50, orderBy: { createdAt: "desc" },
      })
      const [pending, verified, rejected] = await Promise.all([
        prisma.circleVerification.count({ where: { status: "PENDING" } }),
        prisma.circleVerification.count({ where: { status: "VERIFIED" } }),
        prisma.circleVerification.count({ where: { status: "REJECTED" } }),
      ])

      return <VerificationLayout pending={pending} verified={verified} rejected={rejected} filter={filter}>
        <Card className="rounded-2xl"><CardContent className="p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Circle</th><th className="p-3">Owner</th><th className="p-3">Members</th><th className="p-3">Rep</th><th className="p-3">Status</th><th className="p-3 pr-4">Actions</th></tr></thead>
          <tbody>{items.map((c) => (
            <tr key={c.id} className="border-b"><td className="p-3 pl-4 font-medium">{c.name}</td><td className="p-3 text-muted-foreground">{c.createdBy?.name || c.createdBy?.email}</td><td className="p-3">{c._count.members}</td><td className="p-3">{c.reputation?.score || "—"}</td><td className="p-3"><Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 text-[10px]">Not Submitted</Badge></td>
              <td className="p-3 pr-4"><Link href={`/owner/circles/${c.id}`} className="text-brand text-xs hover:underline">View</Link></td></tr>
          ))}</tbody></table></CardContent></Card>
      </VerificationLayout>
    }

    const [verifications, pending, verified, rejected] = await Promise.all([
      prisma.circleVerification.findMany({
        where, include: { circle: { select: { id: true, name: true, type: true, visibility: true, _count: { select: { members: true } }, reputation: true, createdBy: { select: { name: true, email: true } } } } },
        orderBy: { createdAt: "desc" }, take: 100,
      }),
      prisma.circleVerification.count({ where: { status: "PENDING" } }),
      prisma.circleVerification.count({ where: { status: "VERIFIED" } }),
      prisma.circleVerification.count({ where: { status: "REJECTED" } }),
    ])

    console.info("OWNER_PAGE_DATA_READY", { route: "/owner/verifications", itemCount: verifications.length, filter })

    return (
      <VerificationLayout pending={pending} verified={verified} rejected={rejected} filter={filter}>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Verification Criteria</CardTitle></CardHeader><CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {["Public description set", "Rules defined", "Has owner", "3+ members", "Recent activity", "Reputation > 50", "No critical flags", "Verified contact"].map((c, i) => (
            <div key={i} className="flex items-center gap-1.5"><CheckCircle className="size-3 text-emerald-500" /><span className="text-muted-foreground">{c}</span></div>
          ))}
        </CardContent></Card>

        <Card className="rounded-2xl"><CardContent className="p-0">
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Circle</th><th className="p-3">Type</th><th className="p-3">Owner</th><th className="p-3">Members</th><th className="p-3">Rep</th><th className="p-3">Visibility</th><th className="p-3">Status</th><th className="p-3">Submitted</th><th className="p-3 pr-4">Actions</th></tr></thead>
            <tbody>{verifications.map((v) => (
              <tr key={v.id} className="border-b hover:bg-muted/30">
                <td className="p-3 pl-4"><Link href={`/owner/circles/${v.circle.id}`} className="font-medium hover:underline">{v.circle.name}</Link></td>
                <td className="p-3 text-muted-foreground">{v.circle.type}</td>
                <td className="p-3 text-muted-foreground truncate max-w-[100px]">{v.circle.createdBy?.name || v.circle.createdBy?.email}</td>
                <td className="p-3">{v.circle._count.members}</td>
                <td className="p-3">{v.circle.reputation?.score || "—"}</td>
                <td className="p-3"><Badge variant="outline" className="text-[10px]">{v.circle.visibility}</Badge></td>
                <td className="p-3"><Badge variant="outline" className={v.status === "VERIFIED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : v.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : "border-red-200 bg-red-50 text-red-700 text-[10px]"}>{v.status}</Badge></td>
                <td className="p-3 text-muted-foreground">{v.submittedAt ? new Date(v.submittedAt).toLocaleDateString() : "—"}</td>
                <td className="p-3 pr-4">
                  {v.status === "PENDING" && (
                    <div className="flex gap-1">
                      <form action={async () => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("VERIFICATIONS_MANAGE"); await prisma.circleVerification.update({ where: { id: v.id }, data: { status: "VERIFIED", reviewedAt: new Date() } }) }}><Button type="submit" size="sm" className="h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs">Approve</Button></form>
                      <form action={async () => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("VERIFICATIONS_MANAGE"); await prisma.circleVerification.update({ where: { id: v.id }, data: { status: "REJECTED", reviewedAt: new Date() } }) }}><Button type="submit" size="sm" variant="outline" className="h-7 rounded-lg text-xs text-red-600">Reject</Button></form>
                    </div>
                  )}
                  {v.status !== "PENDING" && <Link href={`/owner/circles/${v.circle.id}`} className="text-brand text-xs hover:underline">View</Link>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent></Card>
      </VerificationLayout>
    )
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Verification Center</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Unable to load verification data</h2><p className="text-sm text-muted-foreground mt-1">The verification data could not be retrieved.</p></div>
          <a href="/owner/verifications" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Retry</a>
        </CardContent></Card>
      </div>
    )
  }
}

function VerificationLayout({ pending, verified, rejected, filter, children }: { pending: number; verified: number; rejected: number; filter: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Verification Center</h1><p className="text-muted-foreground">{pending} pending · {verified} verified · {rejected} rejected</p></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold text-amber-600">{pending}</div><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold text-emerald-600">{verified}</div><p className="text-xs text-muted-foreground">Verified</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-600">{rejected}</div><p className="text-xs text-muted-foreground">Rejected</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold"><AlertTriangle className="size-4 mx-auto mb-1 text-amber-500" /></div><p className="text-xs text-muted-foreground">Avg Review</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ label: "Pending", value: "status=PENDING" }, { label: "Verified", value: "status=VERIFIED" }, { label: "Rejected", value: "status=REJECTED" }, { label: "All", value: "status=ALL" }, { label: "Not Submitted", value: "status=PUBLIC_NOT_VERIFIED" }].map((t) => (
          <Link key={t.label} href={`/owner/verifications?${t.value}`}><Badge variant={filter === t.value?.split("=")[1] ? "default" : "outline"} className="cursor-pointer rounded-lg">{t.label}</Badge></Link>
        ))}
      </div>

      {children}
    </div>
  )
}
