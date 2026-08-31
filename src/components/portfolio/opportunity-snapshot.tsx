import Link from "next/link"
import { Rocket, Wallet, Clock, Megaphone, Sparkles, ArrowUpRight } from "lucide-react"

export interface OpportunitySnapshotStats {
  openOpportunities: number
  capitalBeingRaised: number
  myOutstandingCalls: Array<{ id: string; title: string; outstanding: number; dueDate: string | null }>
  closingSoon: number
  recentlyFunded: number
}

export function OpportunitySnapshotStrip({ circleId, snapshot, symbol }: {
  circleId: string
  snapshot: OpportunitySnapshotStats
  symbol: string
}) {
  const myOutstanding = snapshot.myOutstandingCalls.reduce((s, c) => s + c.outstanding, 0)
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Rocket className="size-4 text-brand" /> Opportunities & Capital Calls</h3>
            <p className="text-xs text-muted-foreground">Live raise activity across the circle</p>
          </div>
          <Link href={`/circles/${circleId}/opportunities`} className="inline-flex items-center text-xs text-brand font-medium hover:underline">
            Open <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Tile label="Open opportunities" value={String(snapshot.openOpportunities)} icon={<Rocket className="size-3.5" />} />
          <Tile label="Capital being raised" value={`${symbol}${snapshot.capitalBeingRaised.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Wallet className="size-3.5" />} />
          <Tile label="My outstanding calls" value={snapshot.myOutstandingCalls.length > 0 ? `${snapshot.myOutstandingCalls.length} · ${symbol}${myOutstanding.toLocaleString()}` : "None"} icon={<Clock className="size-3.5" />} tone={snapshot.myOutstandingCalls.length > 0 ? "text-amber-600" : ""} />
          <Tile label="Closing soon (7d)" value={String(snapshot.closingSoon)} icon={<Megaphone className="size-3.5" />} tone={snapshot.closingSoon > 0 ? "text-amber-600" : ""} />
          <Tile label="Recently funded" value={String(snapshot.recentlyFunded)} icon={<Sparkles className="size-3.5" />} />
        </div>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Link href={`/circles/${circleId}/opportunities`} className="inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors">
            <Rocket className="size-3.5 mr-1" /> Opportunities
          </Link>
          <Link href={`/circles/${circleId}/capital-calls`} className="inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors">
            <Wallet className="size-3.5 mr-1" /> Capital calls
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-4 sm:p-5">{children}</div>
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function Tile({ label, value, icon, tone = "" }: { label: string; value: string; icon: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {icon}{label}
      </div>
      <p className={`text-sm sm:text-base font-bold mt-1 truncate ${tone}`}>{value}</p>
    </div>
  )
}