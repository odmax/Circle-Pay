"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Calculator,
  FileCheck,
  Upload,
  CheckCircle2,
  Pencil,
  Scale,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface GroceryCampaignPermissions {
  canViewAll: boolean
  canManageCampaign: boolean
  canManageList: boolean
  canCreateQuote: boolean
  canApproveQuote: boolean
  canManagePurchase: boolean
  canManageAllocation: boolean
  canConfirmOwn: boolean
  canSubmitOwn: boolean
  canCreateContribution: boolean
  canReconcile: boolean
  canCorrect: boolean
}

interface GroceryCampaignProps {
  circleId: string
  campaignId: string
  userId: string
  symbol: string
  permissions: GroceryCampaignPermissions
}

interface CampaignData {
  id: string
  name: string
  description: string | null
  targetAmount: string
  estimatedCost: string
  status: string
  contributionStart: string | null
  contributionEnd: string | null
  distributionDate: string | null
  isFinalized: boolean
  finalizedAt: string | null
  canViewAny: boolean
  amountCollected: string
  targetPercent: number
  membersPaid: number
  membersOutstanding: number
  collectionProgress: number
  purchaseCost: string
  otherExpenses: string
  remainingBalance: string
  savings: string | null
  approvedQuote: { id: string; supplier: string; quoteAmount: string; status: string } | null
  listItems: { id: string; product: string; category: string | null; quantity: number; unit: string | null; estimatedPrice: string; notes: string | null }[]
  supplierQuotes: { id: string; supplier: string; quoteAmount: string; quoteDocUrl: string | null; quoteDocFilename: string | null; notes: string | null; status: string; approvedByName: string | null; approvedAt: string | null }[]
  purchase: { id: string; supplier: string | null; purchaseAmount: string; purchaseDate: string | null; paymentReference: string | null; receiptUrl: string | null; receiptFilename: string | null; status: string } | null
  expenses: { id: string; title: string; amount: string; date: string; category: string | null; receiptUrl: string | null; receiptFilename: string | null }[]
  contributions: { id: string; memberId: string; memberName: string; amount: string; note: string | null; createdAt: string }[] | undefined
  myContributions: { id: string; amount: string; note: string | null; createdAt: string }[]
  allocations: { id: string; memberId: string; memberName: string; items: string; value: string; status: string; confirmedAt: string | null; issueNote: string | null; showValue: boolean }[]
  myAllocation: { id: string; memberId: string; memberName: string; items: string; value: string; status: string; confirmedAt: string | null; showValue: boolean } | null
  members: { id: string; name: string }[]
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PURCHASING: "Purchasing",
  DISTRIBUTING: "Distributing",
  CLOSED: "Closed",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PURCHASING: "border-sky-200 bg-sky-50 text-sky-700",
  DISTRIBUTING: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CLOSED: "border-slate-300 bg-slate-100 text-slate-600",
}

const CONTRIB_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ISSUE_REPORTED: "border-red-200 bg-red-50 text-red-700",
}

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : "—"
}

type Section = "overview" | "list" | "suppliers" | "purchase" | "allocations" | "records" | "reconcile"

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed")
  return data
}

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed")
  return data
}

async function del(url: string) {
  const res = await fetch(url, { method: "DELETE" })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || "Request failed")
  }
}

export function GroceryCampaignClient({ circleId, campaignId, userId, symbol, permissions }: GroceryCampaignProps) {
  const [data, setData] = useState<CampaignData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<Section>("overview")

  // dialogs
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [addQuoteOpen, setAddQuoteOpen] = useState(false)
  const [recordPurchaseOpen, setRecordPurchaseOpen] = useState(false)
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/circles/${circleId}/grocery/${campaignId}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed to load campaign")
      setData(json.campaign)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaign")
    } finally {
      setLoading(false)
    }
  }, [circleId, campaignId])

  useEffect(() => {
    load()
  }, [load])

  // Shared "post action then reload" helper
  const runAction = useCallback(async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn()
      toast.success(successMsg)
      load()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed")
      return false
    }
  }, [load])

  // ─── List item state ────────────────────────────
  const [itemProduct, setItemProduct] = useState("")
  const [itemCategory, setItemCategory] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [itemUnit, setItemUnit] = useState("")
  const [itemPrice, setItemPrice] = useState("")
  const [itemNotes, setItemNotes] = useState("")

  // ─── Quote state ────────────────────────────────
  const [quoteSupplier, setQuoteSupplier] = useState("")
  const [quoteAmount, setQuoteAmount] = useState("")
  const [quoteDocFile, setQuoteDocFile] = useState<File | null>(null)
  const [quoteNotes, setQuoteNotes] = useState("")

  // ─── Purchase state ─────────────────────────────
  const [puSupplier, setPuSupplier] = useState("")
  const [puAmount, setPuAmount] = useState("")
  const [puDate, setPuDate] = useState("")
  const [puRef, setPuRef] = useState("")
  const [puReceipt, setPuReceipt] = useState<File | null>(null)

  // ─── Expense state ──────────────────────────────
  const [exTitle, setExTitle] = useState("")
  const [exAmount, setExAmount] = useState("")
  const [exCategory, setExCategory] = useState("")
  const [exReceipt, setExReceipt] = useState<File | null>(null)

  // ─── Allocation state ───────────────────────────
  const [allocMember, setAllocMember] = useState("")
  const [allocItems, setAllocItems] = useState("")
  const [allocValue, setAllocValue] = useState("")

  // ─── Contribution state ─────────────────────────
  const [contribMember, setContribMember] = useState("")
  const [contribAmount, setContribAmount] = useState("")
  const [contribNote, setContribNote] = useState("")

  // ─── Correct state ──────────────────────────────
  const [correctDelta, setCorrectDelta] = useState("")
  const [correctNote, setCorrectNote] = useState("")
  const [correctReopen, setCorrectReopen] = useState(false)

  const [busy, setBusy] = useState<string | null>(null)

  const activeMembers = useMemo(() => {
    const ids = new Set<string>()
    if (data?.canViewAny) data.contributions?.forEach((c) => ids.add(c.memberId))
    return ids
  }, [data])

  function resetItem() { setItemProduct(""); setItemCategory(""); setItemQty("1"); setItemUnit(""); setItemPrice(""); setItemNotes("") }
  function resetQuote() { setQuoteSupplier(""); setQuoteAmount(""); setQuoteDocFile(null); setQuoteNotes("") }
  function resetPurchase() { setPuSupplier(""); setPuAmount(""); setPuDate(""); setPuRef(""); setPuReceipt(null) }
  function resetExpense() { setExTitle(""); setExAmount(""); setExCategory(""); setExReceipt(null) }
  function resetAlloc() { setAllocMember(""); setAllocItems(""); setAllocValue("") }
  function resetContrib() { setContribMember(""); setContribAmount(""); setContribNote("") }

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
  }

  if (error || !data) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertCircle className="size-6 text-red-500" />
          <p className="text-sm text-muted-foreground">{error ?? "Campaign not found"}</p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={load}>
            <RefreshCw className="size-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const finalized = data.isFinalized
  const canManage = permissions.canManageCampaign

  const tabs: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "overview", label: "Overview", icon: Scale },
    { key: "list", label: "Shopping list", icon: ShoppingCart },
    { key: "suppliers", label: "Suppliers", icon: Truck },
    { key: "purchase", label: "Purchase", icon: Wallet },
    { key: "allocations", label: "Allocations", icon: Users },
    { key: "records", label: "Records", icon: FileCheck },
    { key: "reconcile", label: "Reconcile", icon: Calculator },
  ]

  return (
    <div className="space-y-6">
      {/* Status header */}
      <Card className="rounded-2xl border-border/40">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">{data.name}</p>
                <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[data.status] ?? ""}`}>{STATUS_LABELS[data.status] ?? data.status}</Badge>
                {finalized && <Badge variant="outline" className="text-[10px] border-slate-300 bg-slate-100 text-slate-600">Finalized</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.description ?? "Grocery buying round"}
                {data.distributionDate ? ` · Distribution ${fmtDate(data.distributionDate)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {data.status === "DRAFT" && !finalized && (
                <Button size="sm" className="rounded-lg" disabled={busy !== null} onClick={async () => {
                  setBusy("activate")
                  await runAction(() => postJson(`/api/circles/${circleId}/grocery/${campaignId}/status`, { status: "ACTIVE" }), "Campaign activated")
                  setBusy(null)
                }}><CheckCircle2 className="size-3.5 mr-1" /> Activate</Button>
              )}
              {permissions.canReconcile && !finalized && ["ACTIVE", "PURCHASING", "DISTRIBUTING"].includes(data.status) && (
                <Button size="sm" className="rounded-lg" disabled={busy !== null} onClick={async () => {
                  setBusy("close")
                  await runAction(() => postJson(`/api/circles/${circleId}/grocery/${campaignId}/close`), "Campaign closed")
                  setBusy(null)
                }}>Close campaign</Button>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{symbol}{Number(data.amountCollected).toLocaleString()} of {symbol}{Number(data.targetAmount).toLocaleString()}</span>
              <span>{data.targetPercent}% · {data.membersPaid}/{data.membersPaid + data.membersOutstanding} members</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, data.targetPercent)}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <Button key={t.key} variant={section === t.key ? "default" : "outline"} size="xs" className="rounded-lg whitespace-nowrap" onClick={() => setSection(t.key)}>
              <Icon className="size-3.5 mr-1" /> {t.label}
            </Button>
          )
        })}
      </div>

      {section === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Collected" value={`${symbol}${Number(data.amountCollected).toLocaleString()}`} />
            <StatCard label="Purchase cost" value={`${symbol}${Number(data.purchaseCost).toLocaleString()}`} />
            <StatCard label="Other expenses" value={`${symbol}${Number(data.otherExpenses).toLocaleString()}`} />
            <StatCard label="Remaining balance" value={`${symbol}${Number(data.remainingBalance).toLocaleString()}`} accent={Number(data.remainingBalance) < 0 ? "text-red-600" : "text-emerald-600"} />
          </div>
          {data.savings != null && (
            <p className="text-sm text-muted-foreground">
              Estimated savings vs budget: <span className={Number(data.savings) >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>{symbol}{Number(data.savings).toLocaleString()}</span>
            </p>
          )}
          <Card className="rounded-2xl border-border/40">
            <CardHeader><CardTitle className="text-base">Campaign details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Status"><Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[data.status] ?? ""}`}>{STATUS_LABELS[data.status] ?? data.status}</Badge></Row>
              <Row label="Target amount"><span>{symbol}{Number(data.targetAmount).toLocaleString()}</span></Row>
              <Row label="Estimated cost"><span>{symbol}{Number(data.estimatedCost).toLocaleString()}</span></Row>
              <Row label="Contribution window"><span>{fmtDate(data.contributionStart)} → {fmtDate(data.contributionEnd)}</span></Row>
              <Row label="Distribution date"><span>{fmtDate(data.distributionDate)}</span></Row>
              <Row label="Collection progress"><span>{data.collectionProgress}%</span></Row>
              {data.approvedQuote && (
                <Row label="Approved supplier"><span className="font-medium">{data.approvedQuote.supplier} ({symbol}{Number(data.approvedQuote.quoteAmount).toLocaleString()})</span></Row>
              )}
              {finalized && <Row label="Finalized"><span>{fmtDate(data.finalizedAt)}</span></Row>}
            </CardContent>
          </Card>
        </div>
      )}

      {section === "list" && (
        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Shopping list</CardTitle>
            {permissions.canManageList && !finalized && (
              <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
                <DialogTrigger render={<Button size="sm" className="rounded-lg"><Plus className="size-3.5 mr-1" /> Add item</Button>} />
                <DialogContent>
                  <DialogHeader><DialogTitle>Add shopping list item</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="l-product">Product</Label>
                      <Input id="l-product" value={itemProduct} onChange={(e) => setItemProduct(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="l-cat">Category</Label>
                        <Input id="l-cat" value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} placeholder="e.g. Staples" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="l-unit">Unit</Label>
                        <Input id="l-unit" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} placeholder="e.g. kg" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="l-qty">Quantity</Label>
                        <Input id="l-qty" type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="l-price">Est. price ({symbol})</Label>
                        <Input id="l-price" type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="l-notes">Notes</Label>
                      <Textarea id="l-notes" value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button disabled={busy !== null} onClick={async () => {
                      setBusy("additem")
                      if (!itemProduct.trim()) { toast.error("Product is required"); setBusy(null); return }
                      const ok = await runAction(async () => {
                        const r = await fetch(`/api/circles/${circleId}/grocery/${campaignId}/list-items`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ product: itemProduct.trim(), category: itemCategory || undefined, quantity: Number(itemQty) || 1, unit: itemUnit || undefined, estimatedPrice: itemPrice ? Number(itemPrice) : undefined, notes: itemNotes || undefined }),
                        })
                        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Add failed") }
                      }, "Item added")
                      if (ok) { resetItem(); setAddItemOpen(false) }
                      setBusy(null)
                    }}>Add item</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {data.listItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No items on the shopping list yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Product</th>
                      <th className="py-2 pr-3 font-medium">Qty</th>
                      <th className="py-2 pr-3 font-medium">Est. price</th>
                      <th className="py-2 pr-3 font-medium">Total</th>
                      {permissions.canManageList && !finalized && <th className="py-2 font-medium" />}
                    </tr>
                  </thead>
                  <tbody>
                    {data.listItems.map((it) => (
                      <tr key={it.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">{it.product}</p>
                          <p className="text-xs text-muted-foreground">{it.category ?? ""}{it.notes ? ` — ${it.notes}` : ""}</p>
                        </td>
                        <td className="py-2.5 pr-3">{it.quantity} {it.unit ?? ""}</td>
                        <td className="py-2.5 pr-3">{symbol}{Number(it.estimatedPrice).toLocaleString()}</td>
                        <td className="py-2.5 pr-3 font-semibold">{symbol}{(it.quantity * Number(it.estimatedPrice)).toLocaleString()}</td>
                        {permissions.canManageList && !finalized && (
                          <td className="py-2.5 text-right">
                            <Button variant="ghost" size="icon-sm" className="rounded-lg text-red-500" aria-label="Remove item" onClick={async () => {
                              await runAction(async () => { await del(`/api/circles/${circleId}/grocery/${campaignId}/list-items/${it.id}`) }, "Item removed")
                            }}><Trash2 className="size-4" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {section === "suppliers" && (
        <div className="space-y-4">
          {permissions.canCreateQuote && !finalized && (
            <Dialog open={addQuoteOpen} onOpenChange={(o) => { setAddQuoteOpen(o); if (!o) resetQuote() }}>
              <DialogTrigger render={<Button size="sm" className="rounded-lg"><Plus className="size-3.5 mr-1" /> Add supplier quote</Button>} />
              <DialogContent>
                <DialogHeader><DialogTitle>Add supplier quote</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="q-supplier">Supplier</Label>
                    <Input id="q-supplier" value={quoteSupplier} onChange={(e) => setQuoteSupplier(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-amount">Quote amount ({symbol})</Label>
                    <Input id="q-amount" type="number" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-doc">Quote document (optional)</Label>
                    <Input id="q-doc" type="file" accept="image/*,.pdf" onChange={(e) => setQuoteDocFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-notes">Notes</Label>
                    <Textarea id="q-notes" value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button disabled={busy !== null} onClick={async () => {
                    setBusy("addquote")
                    if (!quoteSupplier.trim() || !quoteAmount) { toast.error("Supplier and amount are required"); setBusy(null); return }
                    const ok = await runAction(async () => {
                      const fd = new FormData()
                      fd.append("supplier", quoteSupplier.trim())
                      fd.append("quoteAmount", quoteAmount)
                      if (quoteNotes) fd.append("notes", quoteNotes)
                      if (quoteDocFile) fd.append("file", quoteDocFile)
                      const r = await fetch(`/api/circles/${circleId}/grocery/${campaignId}/quotes`, { method: "POST", body: fd })
                      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Add failed") }
                    }, "Supplier quote added")
                    if (ok) { resetQuote(); setAddQuoteOpen(false) }
                    setBusy(null)
                  }}>Add quote</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {data.supplierQuotes.length === 0 ? (
            <Card className="rounded-2xl border-border/40"><CardContent className="p-6 text-center text-sm text-muted-foreground">No supplier quotes yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.supplierQuotes.map((q) => (
                <div key={q.id} className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{q.supplier}</p>
                      <Badge variant="outline" className={cn("text-[10px", q.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : q.status === "REJECTED" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600")}>{q.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {symbol}{Number(q.quoteAmount).toLocaleString()}
                      {q.approvedByName ? ` · Approved by ${q.approvedByName} on ${fmtDate(q.approvedAt)}` : ""}
                      {q.notes ? ` · ${q.notes}` : ""}
                    </p>
                    {q.quoteDocUrl && (
                      <a href={q.quoteDocUrl} target="_blank" rel="noreferrer" className="text-xs text-brand inline-flex items-center gap-1 mt-1"><Pencil className="size-3" /> {q.quoteDocFilename ?? "Quote document"}</a>
                    )}
                  </div>
                  {permissions.canApproveQuote && q.status === "PENDING" && !finalized && (
                    <Button size="sm" className="rounded-lg" disabled={busy !== null} onClick={async () => {
                      setBusy(`approve-${q.id}`)
                      await runAction(() => postJson(`/api/circles/${circleId}/grocery/${campaignId}/quotes/${q.id}/approve`), "Supplier approved")
                      setBusy(null)
                    }}><CheckCircle2 className="size-3.5 mr-1" /> Approve</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === "purchase" && (
        <div className="space-y-4">
          {permissions.canManagePurchase && !finalized && (
            <Dialog open={recordPurchaseOpen} onOpenChange={(o) => { setRecordPurchaseOpen(o); if (!o) resetPurchase() }}>
              <DialogTrigger render={<Button size="sm" className="rounded-lg"><Plus className="size-3.5 mr-1" /> Record purchase</Button>} />
              <DialogContent>
                <DialogHeader><DialogTitle>Record purchase</DialogTitle><DialogDescription>Post the supplier purchase against this campaign.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="p-supplier">Supplier</Label>
                    <Input id="p-supplier" value={puSupplier} onChange={(e) => setPuSupplier(e.target.value)} placeholder={data.approvedQuote?.supplier ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-amount">Purchase amount ({symbol})</Label>
                    <Input id="p-amount" type="number" value={puAmount} onChange={(e) => setPuAmount(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="p-date">Purchase date</Label>
                      <Input id="p-date" type="date" value={puDate} onChange={(e) => setPuDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="p-ref">Payment reference</Label>
                      <Input id="p-ref" value={puRef} onChange={(e) => setPuRef(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p-receipt">Receipt (optional)</Label>
                    <Input id="p-receipt" type="file" accept="image/*,.pdf" onChange={(e) => setPuReceipt(e.target.files?.[0] ?? null)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button disabled={busy !== null} onClick={async () => {
                    setBusy("purchase")
                    if (!puAmount) { toast.error("Purchase amount is required"); setBusy(null); return }
                    const ok = await runAction(async () => {
                      const fd = new FormData()
                      if (puSupplier) fd.append("supplier", puSupplier)
                      fd.append("purchaseAmount", puAmount)
                      if (puDate) fd.append("purchaseDate", puDate)
                      if (puRef) fd.append("paymentReference", puRef)
                      if (puReceipt) fd.append("file", puReceipt)
                      const r = await fetch(`/api/circles/${circleId}/grocery/${campaignId}/purchase`, { method: "POST", body: fd })
                      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Record failed") }
                    }, "Purchase recorded")
                    if (ok) { resetPurchase(); setRecordPurchaseOpen(false) }
                    setBusy(null)
                  }}>Record purchase</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Card className="rounded-2xl border-border/40">
            <CardContent className="space-y-2 p-5 text-sm">
              {data.purchase ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{data.purchase.supplier ?? "Supplier"}</p>
                    <Badge variant="outline" className="text-[10px border-emerald-200 bg-emerald-50 text-emerald-700">{data.purchase.status}</Badge>
                  </div>
                  <Row label="Amount"><span className="font-semibold">{symbol}{Number(data.purchase.purchaseAmount).toLocaleString()}</span></Row>
                  <Row label="Date"><span>{fmtDate(data.purchase.purchaseDate)}</span></Row>
                  {data.purchase.paymentReference && <Row label="Reference"><span>{data.purchase.paymentReference}</span></Row>}
                  {data.purchase.receiptUrl && (
                    <Row label="Receipt"><a href={data.purchase.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand"><Upload className="size-3.5" /> {data.purchase.receiptFilename ?? "View receipt"}</a></Row>
                  )}
                  {data.purchase.status === "RECORDED" && permissions.canManagePurchase && !finalized && (
                    <div className="pt-2">
                      <Button size="sm" className="rounded-lg" disabled={busy !== null} onClick={async () => {
                        setBusy("confirmpurchase")
                        await runAction(() => postJson(`/api/circles/${circleId}/grocery/${campaignId}/purchase/confirm`), "Purchase confirmed")
                        setBusy(null)
                      }}><CheckCircle2 className="size-3.5 mr-1" /> Confirm purchase</Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No purchase recorded for this campaign.</p>
              )}
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Other expenses</CardTitle>
              {permissions.canManagePurchase && !finalized && (
                <Dialog open={addExpenseOpen} onOpenChange={(o) => { setAddExpenseOpen(o); if (!o) resetExpense() }}>
                  <DialogTrigger render={<Button size="sm" className="rounded-lg"><Plus className="size-3.5 mr-1" /> Add expense</Button>} />
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5"><Label>Title</Label><Input value={exTitle} onChange={(e) => setExTitle(e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label>Amount ({symbol})</Label><Input type="number" value={exAmount} onChange={(e) => setExAmount(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Category</Label><Input value={exCategory} onChange={(e) => setExCategory(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1.5"><Label>Receipt</Label><Input type="file" accept="image/*,.pdf" onChange={(e) => setExReceipt(e.target.files?.[0] ?? null)} /></div>
                    </div>
                    <DialogFooter>
                      <Button disabled={busy !== null} onClick={async () => {
                        setBusy("expense")
                        if (!exTitle.trim() || !exAmount) { toast.error("Title and amount are required"); setBusy(null); return }
                        const ok = await runAction(async () => {
                          const fd = new FormData()
                          fd.append("title", exTitle.trim())
                          fd.append("amount", exAmount)
                          if (exCategory) fd.append("category", exCategory)
                          if (exReceipt) fd.append("file", exReceipt)
                          const r = await fetch(`/api/circles/${circleId}/grocery/${campaignId}/expenses`, { method: "POST", body: fd })
                          if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error || "Add failed") }
                        }, "Expense added")
                        if (ok) { resetExpense(); setAddExpenseOpen(false) }
                        setBusy(null)
                      }}>Add expense</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {data.expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No other expenses.</p>
              ) : (
                <div className="space-y-2">
                  {data.expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm">
                      <div>
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(e.date)}{e.category ? ` · ${e.category}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-brand"><Upload className="size-4" /></a>}
                        <span className="font-semibold">{symbol}{Number(e.amount).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {section === "allocations" && (
        <div className="space-y-4">
          {permissions.canManageAllocation && !finalized && (
            <Dialog open={allocateOpen} onOpenChange={(o) => { setAllocateOpen(o); if (!o) resetAlloc() }}>
              <DialogTrigger render={<Button size="sm" className="rounded-lg"><Plus className="size-3.5 mr-1" /> Create allocation</Button>} />
              <DialogContent>
                <DialogHeader><DialogTitle>Create member allocation</DialogTitle><DialogDescription>Assign purchased goods to a member.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="a-member">Member</Label>
                    <Select value={allocMember || undefined} onValueChange={(v) => setAllocMember(v ?? "")}>
                      <SelectTrigger className="w-full" id="a-member"><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent>
                        {data.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="a-items">Items</Label>
                    <Textarea id="a-items" value={allocItems} onChange={(e) => setAllocItems(e.target.value)} placeholder="e.g. 2x rice, 5kg maize meal" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="a-value">Allocation value ({symbol})</Label>
                    <Input id="a-value" type="number" value={allocValue} onChange={(e) => setAllocValue(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button disabled={busy !== null} onClick={async () => {
                    setBusy("alloc")
                    if (!allocMember.trim() || !allocItems.trim() || !allocValue) { toast.error("Member, items and value are required"); setBusy(null); return }
                    const ok = await runAction(async () => {
                      await postJson(`/api/circles/${circleId}/grocery/${campaignId}/allocations`, { memberId: allocMember.trim(), items: allocItems.trim(), value: Number(allocValue) })
                    }, "Allocation created")
                    if (ok) { resetAlloc(); setAllocateOpen(false) }
                    setBusy(null)
                  }}>Create allocation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {data.allocations.length === 0 ? (
            <Card className="rounded-2xl border-border/40"><CardContent className="p-6 text-center text-sm text-muted-foreground">No allocations yet.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.allocations.map((a) => {
                const mine = a.memberId === userId
                return (
                  <div key={a.id} className={cn("rounded-xl border p-3", mine ? "border-brand/40 bg-brand/5" : "border-border/60")}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{a.memberName}{mine ? " (you)" : ""}</p>
                        <Badge variant="outline" className={cn("text-[10px", CONTRIB_STATUS_COLORS[a.status] ?? "")}>{a.status === "CONFIRMED" ? "Confirmed" : a.status === "ISSUE_REPORTED" ? "Issue reported" : "Pending"}</Badge>
                      </div>
                      {a.showValue && <span className="font-semibold">{symbol}{Number(a.value).toLocaleString()}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.items}</p>
                    {a.confirmedAt && <p className="text-xs text-muted-foreground mt-0.5">Confirmed {fmtDate(a.confirmedAt)}</p>}
                    {a.issueNote && <p className="text-xs text-red-600 mt-0.5">Issue: {a.issueNote}</p>}
                    {mine && permissions.canConfirmOwn && a.status === "PENDING" && !finalized && (
                      <div className="mt-2 flex gap-2">
                        <Button size="xs" className="rounded-lg" disabled={busy !== null} onClick={async () => {
                          setBusy(`confirm-${a.id}`)
                          await runAction(() => postJson(`/api/circles/${circleId}/grocery/${campaignId}/allocations/${a.id}/confirm`), "Allocation confirmed")
                          setBusy(null)
                        }}><CheckCircle2 className="size-3 mr-1" /> Confirm collection</Button>
                        <Button size="xs" variant="outline" className="rounded-lg" disabled={busy !== null} onClick={async () => {
                          const note = window.prompt("Describe the issue with this allocation:", "")
                          if (note == null) return
                          setBusy(`issue-${a.id}`)
                          await runAction(() => postJson(`/api/circles/${circleId}/grocery/${campaignId}/allocations/${a.id}/issue`, { note }), "Issue reported")
                          setBusy(null)
                        }}>Report issue</Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {data.myAllocation && permissions.canConfirmOwn && (
            <div className="text-xs text-muted-foreground">You can confirm or report an issue on your own allocation.</div>
          )}
        </div>
      )}

      {section === "records" && (
        <div className="space-y-4">
          {permissions.canSubmitOwn && !finalized && (
            <Dialog open={contributeOpen} onOpenChange={(o) => { setContributeOpen(o); if (!o) resetContrib() }}>
              <DialogTrigger render={<Button size="sm" className="rounded-lg"><Plus className="size-3.5 mr-1" /> Add contribution</Button>} />
              <DialogContent>
                <DialogHeader><DialogTitle>Record contribution</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-member">Member</Label>
                    <Select value={contribMember || undefined} onValueChange={(v) => setContribMember(v ?? "")}>
                      <SelectTrigger className="w-full" id="c-member"><SelectValue placeholder={permissions.canCreateContribution ? "Select member" : "You"} /></SelectTrigger>
                      <SelectContent>
                        {permissions.canCreateContribution && data.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!permissions.canCreateContribution && (
                      <p className="text-xs text-muted-foreground">Recording a contribution for yourself.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-amount">Amount ({symbol})</Label>
                    <Input id="c-amount" type="number" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-note">Note</Label>
                    <Input id="c-note" value={contribNote} onChange={(e) => setContribNote(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button disabled={busy !== null} onClick={async () => {
                    setBusy("contrib")
                    if (!contribAmount) { toast.error("Amount is required"); setBusy(null); return }
                    const ok = await runAction(async () => {
                      const isSelf = !contribMember.trim()
                      await postJson(`/api/circles/${circleId}/grocery/${campaignId}/contributions`, { memberId: isSelf ? userId : contribMember.trim(), amount: Number(contribAmount), note: contribNote || undefined })
                    }, "Contribution recorded")
                    if (ok) { resetContrib(); setContributeOpen(false) }
                    setBusy(null)
                  }}>Record contribution</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* My contributions */}
            <Card className="rounded-2xl border-border/40">
              <CardHeader><CardTitle className="text-base">My contributions</CardTitle></CardHeader>
              <CardContent>
                {data.myContributions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contributions recorded for you.</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    {data.myContributions.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                        <div>
                          <p className="font-semibold">{symbol}{Number(c.amount).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}{c.note ? ` · ${c.note}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All contributions (view all) */}
            {(data.canViewAny || permissions.canViewAll) && (
              <Card className="rounded-2xl border-border/40">
                <CardHeader><CardTitle className="text-base">All member contributions</CardTitle></CardHeader>
                <CardContent>
                  {!data.contributions || data.contributions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contributions recorded.</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {data.contributions.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                          <div>
                            <p className="font-medium">{c.memberName}</p>
                            <p className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}{c.note ? ` · ${c.note}` : ""}</p>
                          </div>
                          <span className="font-semibold">{symbol}{Number(c.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {section === "reconcile" && (
        <Card className="rounded-2xl border-border/40">
          <CardHeader><CardTitle className="text-base">Reconciliation & close</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Contributions" value={`${symbol}${Number(data.amountCollected).toLocaleString()}`} />
              <StatCard label="Purchase cost" value={`${symbol}${Number(data.purchaseCost).toLocaleString()}`} />
              <StatCard label="Other expenses" value={`${symbol}${Number(data.otherExpenses).toLocaleString()}`} />
              <StatCard label="Remaining balance" value={`${symbol}${Number(data.remainingBalance).toLocaleString()}`} accent={Number(data.remainingBalance) < 0 ? "text-red-600" : "text-emerald-600"} />
            </div>

            <div className="rounded-xl border border-border/60 p-4 text-sm space-y-2">
              <p className="font-medium">Allocation value by member</p>
              {data.allocations.length === 0 ? (
                <p className="text-muted-foreground">No allocations to show.</p>
              ) : (
                data.allocations.map((a) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span>{a.memberName}</span>
                    <span className="font-semibold">{symbol}{Number(a.value).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>

            {!finalized && permissions.canReconcile && ["ACTIVE", "PURCHASING", "DISTRIBUTING"].includes(data.status) && (
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy !== null} onClick={async () => {
                  setBusy("reconcile")
                  await runAction(() => postJson(`/api/circles/${circleId}/grocery/${campaignId}/reconcile`), "Reconciliation saved")
                  setBusy(null)
                }}><Calculator className="size-4 mr-1" /> Save reconciliation</Button>
                <Button disabled={busy !== null} onClick={async () => {
                  setBusy("close")
                  await runAction(() => postJson(`/api/circles/${circleId}/grocery/${campaignId}/close`), "Campaign closed")
                  setBusy(null)
                }}><CheckCircle2 className="size-4 mr-1" /> Close & finalize</Button>
              </div>
            )}

            {finalized && (
              <p className="text-sm text-muted-foreground">This campaign is finalized. Corrections require the GROCERY_CORRECT permission.</p>
            )}

            {permissions.canCorrect && finalized && (
              <Dialog>
                <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-lg"><Pencil className="size-3.5 mr-1" /> Correct campaign</Button>} />
                <DialogContent>
                  <DialogHeader><DialogTitle>Correct finalized campaign</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cor-delta">Remaining balance delta ({symbol})</Label>
                      <Input id="cor-delta" type="number" value={correctDelta} onChange={(e) => setCorrectDelta(e.target.value)} placeholder="Optional positive or negative adjustment" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cor-note">Correction note (required)</Label>
                      <Textarea id="cor-note" value={correctNote} onChange={(e) => setCorrectNote(e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={correctReopen} onChange={(e) => setCorrectReopen(e.target.checked)} />
                      Reopen campaign instead
                    </label>
                  </div>
                  <DialogFooter>
                    <Button disabled={busy !== null} onClick={async () => {
                      setBusy("correct")
                      if (!correctNote.trim()) { toast.error("A correction note is required"); setBusy(null); return }
                      const ok = await runAction(async () => {
                        await postJson(`/api/circles/${circleId}/grocery/${campaignId}/correct`, {
                          remainingBalanceDelta: !correctReopen && correctDelta !== "" ? Number(correctDelta) : undefined,
                          reopen: correctReopen || undefined,
                          note: correctNote.trim(),
                        })
                      }, "Campaign corrected")
                      if (ok) { setCorrectDelta(""); setCorrectNote(""); setCorrectReopen(false) }
                      setBusy(null)
                    }}>Apply correction</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="rounded-2xl border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{label}</div>
        <p className={`text-xl font-bold mt-1 ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
