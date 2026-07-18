import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Star, Search, StarOff, AlertTriangle } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export default async function OwnerDiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  await requireOwnerPage(PERMISSIONS.DISCOVER_MANAGE)
  const where: Record<string, unknown> = { visibility: "PUBLIC" }
  if (params.search) where.name = { contains: params.search, mode: "insensitive" }
  if (params.type) where.type = params.type
  if (params.country) where.country = { contains: params.country, mode: "insensitive" }
  if (params.featured === "true") where.isFeatured = true

  let circles: any[] = [], total = 0, featured = 0, verified = 0, pending = 0, totalMembers = 0, pendingJoins = 0
  try {
    ;[circles, total, featured, verified, pending, totalMembers, pendingJoins] = await Promise.all([
      prisma.circle.findMany({
        where, orderBy: { createdAt: "desc" }, take: 50,
        include: { _count: { select: { members: true } }, verification: true, reputation: true, createdBy: { select: { name: true, email: true } } },
      }),
      prisma.circle.count({ where }),
      prisma.circle.count({ where: { visibility: "PUBLIC", isFeatured: true } }),
      prisma.circleVerification.count({ where: { circle: { visibility: "PUBLIC" }, status: "VERIFIED" } }),
      prisma.circleVerification.count({ where: { circle: { visibility: "PUBLIC" }, status: "PENDING" } }),
      prisma.circleMember.count({ where: { circle: { visibility: "PUBLIC" } } }),
      prisma.joinRequest.count({ where: { circle: { visibility: "PUBLIC" }, status: "PENDING" } }),
    ])
  } catch {
  console.info("OWNER_PAGE_DATA_READY", { route: "/owner/discover", itemCount: circles.length, total })

  return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Discover Admin</h1>
        <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <AlertTriangle className="size-10 text-red-500" />
          <div><h2 className="text-lg font-semibold">Unable to load discover data</h2><p className="text-sm text-muted-foreground mt-1">The discover data could not be retrieved.</p></div>
          <a href="/owner/discover" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Retry</a>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discover Admin</h1>
        <p className="text-muted-foreground">{total} public circles · {featured} featured · {pendingJoins} pending joins</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold">{total}</div><p className="text-xs text-muted-foreground">Public Circles</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold">{featured}</div><p className="text-xs text-muted-foreground">Featured</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold">{verified}</div><p className="text-xs text-muted-foreground">Verified</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-3 text-center"><div className="text-xl font-bold">{totalMembers}</div><p className="text-xs text-muted-foreground">Public Members</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ label: "All", value: "" }, { label: "Featured", value: "featured=true" }, { label: "Stokvel", value: "type=STOKVEL" }, { label: "Savings", value: "type=SAVINGS" }, { label: "Church", value: "type=CHURCH" }, { label: "Invest", value: "type=INVESTMENT" }, { label: "Family", value: "type=FAMILY" }].map((t) => (
          <Link key={t.label} href={`/owner/discover?${t.value}`}><Badge variant={new URLSearchParams(params as any).toString() === t.value ? "default" : "outline"} className="cursor-pointer rounded-lg">{t.label}</Badge></Link>
        ))}
      </div>

      <form className="flex gap-2"><Input name="search" placeholder="Search public circles..." defaultValue={params.search} className="rounded-xl max-w-sm" /><Button type="submit" size="sm" variant="outline" className="rounded-xl"><Search className="size-4" /></Button></form>

      <Card className="rounded-2xl"><CardContent className="p-0">
        <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">Name</th><th className="p-3">Type</th><th className="p-3">Owner</th><th className="p-3">Country</th><th className="p-3">Members</th><th className="p-3">Rep</th><th className="p-3">Verify</th><th className="p-3">Featured</th><th className="p-3 pr-4">Actions</th></tr></thead>
          <tbody>{circles.map((c) => (
            <tr key={c.id} className="border-b hover:bg-muted/30">
              <td className="p-3 pl-4"><Link href={`/discover`} className="font-medium hover:underline">{c.name}</Link></td>
              <td className="p-3"><Badge variant="outline" className="text-[10px]">{c.type}</Badge></td>
              <td className="p-3 text-muted-foreground truncate max-w-[100px]">{c.createdBy?.name || c.createdBy?.email}</td>
              <td className="p-3 text-muted-foreground">{c.country || "—"}{c.city ? `, ${c.city}` : ""}</td>
              <td className="p-3">{c._count.members}</td>
              <td className="p-3">{c.reputation?.score || "—"}</td>
              <td className="p-3"><Badge variant="outline" className={c.verification?.status === "VERIFIED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]" : c.verification?.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : "text-[10px]"}>{c.verification?.status || "—"}</Badge></td>
              <td className="p-3">
                {c.isFeatured ? (
                  <form action={async () => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("DISCOVER_MANAGE"); await prisma.circle.update({ where: { id: c.id }, data: { isFeatured: false } }) }}><Button type="submit" size="sm" variant="ghost" className="h-6 text-xs text-amber-600"><Star className="size-3" /></Button></form>
                ) : (
                  <form action={async () => { "use server"; const { requireOwnerAction } = await import("@/lib/services/owner-permission.service"); await requireOwnerAction("DISCOVER_MANAGE"); await prisma.circle.update({ where: { id: c.id }, data: { isFeatured: true, featuredAt: new Date() } }) }}><Button type="submit" size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground"><StarOff className="size-3" /></Button></form>
                )}
              </td>
              <td className="p-3 pr-4 flex gap-1">
                <Link href={`/owner/circles/${c.id}`} className="text-brand text-xs hover:underline">View</Link>
                <Link href={`/owner/circles/${c.id}`} className="text-brand text-xs hover:underline">Edit</Link>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </CardContent></Card>
    </div>
  )
}
