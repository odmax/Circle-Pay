import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOwnerNotes } from "@/lib/services/owner-permission.service"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default async function OwnerWalletDetailPage({ params }: { params: Promise<{ walletId: string }> }) {
  const session = await auth(); if (!session?.user?.id) notFound()
  const { walletId } = await params
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    include: { circle: { select: { id: true, name: true } }, accounts: true, transactions: { take: 10, orderBy: { createdAt: "desc" }, include: { initiatedBy: { select: { name: true } } } } },
  })
  if (!wallet) notFound()
  const notes = await getOwnerNotes("WALLET", walletId).catch(() => [])

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Owner", href: "/owner" }, { label: "Wallets", href: "/owner/wallets" }, { label: wallet.name }]} />
      <div className="flex items-center gap-4"><Button render={<Link href="/owner/wallets" />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button><h1 className="text-2xl font-bold tracking-tight">{wallet.name}</h1></div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Type</span><p className="font-medium">{wallet.type}</p></div>
            <div><span className="text-muted-foreground">Status</span><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{wallet.status}</Badge></div>
            {wallet.circle && <div><span className="text-muted-foreground">Circle</span><Link href={`/owner/circles/${wallet.circle.id}`} className="font-medium hover:underline">{wallet.circle.name}</Link></div>}
            <div><span className="text-muted-foreground">Accounts</span><p className="font-medium">{wallet.accounts.length}</p></div>
            <div><span className="text-muted-foreground">Created</span><p className="font-medium">{new Date(wallet.createdAt).toLocaleDateString()}</p></div>
          </CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Accounts</CardTitle></CardHeader><CardContent>{wallet.accounts.map((a) => (<div key={a.id} className="flex justify-between text-sm py-1 border-b last:border-0"><span>{a.name}</span><span className="text-muted-foreground">{a.type}</span></div>))}</CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Recent Transactions</CardTitle></CardHeader><CardContent>{wallet.transactions.length === 0 ? <p className="text-sm text-muted-foreground">No transactions</p> : wallet.transactions.map((t) => (
            <div key={t.id} className="flex justify-between text-sm py-1 border-b last:border-0"><span>{t.type}</span><span className="font-mono">R{Number(t.amount).toLocaleString()}</span><Badge variant="outline" className="text-[10px]">{t.status}</Badge></div>
          ))}</CardContent></Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader><CardContent className="space-y-2">
            <Button render={<Link href={`/api/owner/wallets/export.csv?walletId=${walletId}`} />} size="sm" variant="outline" className="w-full rounded-xl">Export CSV</Button>
          </CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Notes ({notes.length})</CardTitle></CardHeader><CardContent>{notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes</p> : notes.map((n) => (<div key={n.id} className="text-sm border-b pb-2 mb-2"><p>{n.note}</p><p className="text-xs text-muted-foreground">{n.admin.name} · {new Date(n.createdAt).toLocaleString()}</p></div>))}</CardContent></Card>
        </div>
      </div>
    </div>
  )
}
