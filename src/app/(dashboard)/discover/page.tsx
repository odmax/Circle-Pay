import { redirect } from "next/navigation"
import Link from "next/link"
import { Search, Users, Globe, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { getDiscoverCircles } from "@/lib/services/discover.service"
import { getLocalizedTypeLabel } from "@/lib/localized-circle-names"
import { getCircleIcon } from "@/components/circles/circle-type-badge"
import { createElement } from "react"
import { RequestJoinButton } from "@/components/circles/request-join-button"
import { CircleTypeBadge } from "@/components/circles/circle-type-badge"

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ type?: string; search?: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const filters = await searchParams
  const circles = await getDiscoverCircles(session.user.id, filters)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discover Circles</h1>
        <p className="text-muted-foreground">Find public groups to join</p>
      </div>

      {/* Trust Notice */}
      <Card className="rounded-2xl border-amber-200 bg-amber-50/20">
        <CardContent className="flex items-start gap-3 p-4">
          <Shield className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Stay safe</p>
            <p className="text-amber-700">Only join circles you trust. Circle Pay helps track finances, but members are responsible for group rules and contributions.</p>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <form className="flex gap-2 flex-1">
          <Input name="search" placeholder="Search circles..." defaultValue={filters.search} className="rounded-xl max-w-xs" />
          <Button type="submit" variant="outline" size="sm" className="rounded-xl"><Search className="size-4" /></Button>
        </form>
        {["STOKVEL", "SAVINGS", "HOUSEMATE", "TRAVEL", "CHURCH", "INVESTMENT", "FAMILY", "WEDDING", "CUSTOM"].map((t) => (
          <Link key={t} href={`/discover?type=${filters.type === t ? "" : t}`}>
            <Badge variant={filters.type === t ? "default" : "outline"} className="cursor-pointer rounded-lg">{getLocalizedTypeLabel(t)}</Badge>
          </Link>
        ))}
      </div>

      {/* Results */}
      {circles.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Globe className="size-10 text-muted-foreground/50 mb-3" />
          <p className="font-medium">No public circles found</p>
          <p className="text-sm text-muted-foreground">Try a different search or create your own circle</p>
          <Button render={<Link href="/circles/new" />} className="mt-4 rounded-xl bg-brand hover:bg-brand-600">Create a Circle</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {circles.map((c) => {
            const Icon = getCircleIcon(c.type)
            const ccy = c.settings?.contributionAmount || c.settings?.rentAmount || c.settings?.savingAmount
            const amount = ccy ? Number(ccy) : null
            return (
              <Card key={c.id} className="rounded-2xl border-border/40">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">{createElement(Icon, { className: "size-5" })}</div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                      <CircleTypeBadge type={c.type} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {c.country && <span className="flex items-center gap-1"><Globe className="size-3" /> {c.country}{c.city ? `, ${c.city}` : ""}</span>}
                    <span className="flex items-center gap-1"><Users className="size-3" /> {c.memberCount}</span>
                    {!c.joinApprovalRequired && <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">Instant join</Badge>}
                  </div>
                  {amount && <p className="text-sm font-mono font-bold text-brand">{amount.toLocaleString()} /period</p>}
                  {c.publicDescription && <p className="text-xs text-muted-foreground line-clamp-2">{c.publicDescription}</p>}
                  <div className="flex gap-2">
                    <Button render={<Link href={`/circles/${c.id}`} />} variant="outline" size="sm" className="rounded-xl flex-1">View</Button>
                    {c.isMember ? (
                      <Badge className="bg-emerald-50 text-emerald-700">Member</Badge>
                    ) : c.hasPendingRequest ? (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Pending</Badge>
                    ) : (
                      <RequestJoinButton circleId={c.id} />
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
