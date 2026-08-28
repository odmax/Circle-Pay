"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingCart, Plus, RefreshCw, AlertCircle, Calendar } from "lucide-react"
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

export interface GroceryPermissions {
  canViewAll: boolean
  canCreateCampaign: boolean
  canManageCampaign: boolean
}

interface GroceryClientProps {
  circleId: string
  symbol: string
  permissions: GroceryPermissions
}

interface CampaignSummary {
  id: string
  name: string
  targetAmount: string
  estimatedCost: string
  status: string
  distributionDate: string | null
  contributionEnd: string | null
  isFinalized: boolean
  amountCollected: string
  targetPercent: number
  membersPaid: number
  membersOutstanding: number
  listItemCount: number
  quoteCount: number
  allocationCount: number
  approvedSupplier: string | null
  createdAt: string
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

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : "—"
}

async function getJson(url: string) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed")
  return data
}

export function GroceryClient({ circleId, symbol, permissions }: GroceryClientProps) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // create form
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [targetAmount, setTargetAmount] = useState("")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [contributionStart, setContributionStart] = useState("")
  const [contributionEnd, setContributionEnd] = useState("")
  const [distributionDate, setDistributionDate] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getJson(`/api/circles/${circleId}/grocery`)
      setCampaigns(res.campaigns ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load grocery campaigns")
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    if (!name.trim()) return toast.error("Give the campaign a name")
    setSaving(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/grocery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description || undefined,
          targetAmount: targetAmount ? Number(targetAmount) : undefined,
          estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
          contributionStart: contributionStart || undefined,
          contributionEnd: contributionEnd || undefined,
          distributionDate: distributionDate || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to create campaign")
      toast.success("Grocery campaign created")
      setOpen(false)
      setName("")
      setDescription("")
      setTargetAmount("")
      setEstimatedCost("")
      setContributionStart("")
      setContributionEnd("")
      setDistributionDate("")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create campaign")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <AlertCircle className="size-8 text-red-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={load}>
            <RefreshCw className="size-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const openCampaigns = campaigns.filter((c) => !["CLOSED", "DRAFT"].includes(c.status))
  const collected = campaigns.reduce((s, c) => s + Number(c.amountCollected), 0)
  const totalTarget = campaigns.reduce((s, c) => s + Number(c.targetAmount), 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <ShoppingCart className="size-4" /> Active campaigns
            </div>
            <p className="text-2xl font-bold mt-1">{openCampaigns.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Calendar className="size-4" /> Collected
            </div>
            <p className="text-2xl font-bold mt-1">{symbol}{collected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <ShoppingCart className="size-4" /> Total campaigns
            </div>
            <p className="text-2xl font-bold mt-1">{campaigns.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/40">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Grocery campaigns</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" className="rounded-lg" onClick={load} aria-label="Refresh">
              <RefreshCw className="size-3.5" />
            </Button>
            {permissions.canCreateCampaign && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger render={<Button size="sm" className="rounded-lg"><Plus className="size-3.5 mr-1" /> New campaign</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New grocery campaign</DialogTitle>
                    <DialogDescription>Set up a staggered grocery buying round for your stokvel.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="g-name">Campaign name</Label>
                      <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="December groceries" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g-desc">Description</Label>
                      <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="g-target">Target amount ({symbol})</Label>
                        <Input id="g-target" type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="g-est">Estimated cost ({symbol})</Label>
                        <Input id="g-est" type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="g-start">Contribution start</Label>
                        <Input id="g-start" type="date" value={contributionStart} onChange={(e) => setContributionStart(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="g-end">Contribution end</Label>
                        <Input id="g-end" type="date" value={contributionEnd} onChange={(e) => setContributionEnd(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g-dist">Distribution date</Label>
                      <Input id="g-dist" type="date" value={distributionDate} onChange={(e) => setDistributionDate(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreate} disabled={saving}>
                      {saving ? "Creating…" : "Create campaign"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <ShoppingCart className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No grocery campaigns yet.</p>
              {permissions.canCreateCampaign && (
                <Button size="sm" className="rounded-xl" onClick={() => setOpen(true)}>
                  <Plus className="size-4 mr-1" /> Create first campaign
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <Link key={c.id} href={`/circles/${circleId}/grocery/${c.id}`} className="block">
                  <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-3 hover:border-brand/40 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{c.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[c.status] ?? ""}`}>
                          {STATUS_LABELS[c.status] ?? c.status}
                        </Badge>
                        {c.isFinalized && <Badge variant="outline" className="text-[10px] border-slate-300 bg-slate-100 text-slate-600">Finalized</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {symbol}{Number(c.amountCollected).toLocaleString()} of {symbol}{Number(c.targetAmount).toLocaleString()} collected
                        {c.distributionDate ? ` · Distribution ${fmtDate(c.distributionDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Progress</p>
                        <p className="font-semibold">{c.targetPercent}%</p>
                      </div>
                      <div className="hidden w-24 h-1.5 rounded-full bg-slate-200 sm:block">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, c.targetPercent)}%` }} />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">List items</p>
                        <p className="font-semibold">{c.listItemCount}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
