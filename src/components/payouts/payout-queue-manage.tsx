"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Settings2, Users, Shuffle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export function PayoutQueueManage({
  circleId,
  hasQueue,
  canManage,
  mode,
}: {
  circleId: string
  hasQueue: boolean
  canManage: boolean
  mode: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState<"setup" | "configure" | "draw" | null>(null)
  const [loading, setLoading] = useState(false)

  const [pMode, setPMode] = useState("FIXED_ORDER")
  const [frequency, setFrequency] = useState("MONTHLY")
  const [amount, setAmount] = useState("")
  const [useCollectedPot, setUseCollectedPot] = useState(false)
  const [graceDays, setGraceDays] = useState("0")
  const [requireConfirmed, setRequireConfirmed] = useState(false)
  const [minApprovals, setMinApprovals] = useState("0")
  const [requireBeneficiary, setRequireBeneficiary] = useState(false)
  const [allowSwap, setAllowSwap] = useState(false)

  async function createQueue() {
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/payouts?action=create`, { method: "POST" })
      if (!res.ok) throw await res.json()
      toast.success("Payout rotation created")
      setOpen(null)
      router.refresh()
    } catch (err: any) {
      toast.error(err?.error || "Failed to create rotation")
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        mode: pMode as any,
        frequency: frequency as any,
        useCollectedPot,
        graceDays: Number(graceDays),
        requireConfirmedContributions: requireConfirmed,
        minimumApprovals: Number(minApprovals),
        requireBeneficiaryConfirmation: requireBeneficiary,
        allowSwap,
      }
      if (amount) body.amount = Number(amount)
      const res = await fetch(`/api/circles/${circleId}/payouts?action=config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw await res.json()
      toast.success("Configuration saved")
      setOpen(null)
      router.refresh()
    } catch (err: any) {
      toast.error(err?.error || "Failed to save configuration")
    } finally {
      setLoading(false)
    }
  }

  async function runDraw() {
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/payouts?action=draw`, { method: "POST" })
      if (!res.ok) throw await res.json()
      toast.success("Draw completed")
      setOpen(null)
      router.refresh()
    } catch (err: any) {
      toast.error(err?.error || "Draw failed")
    } finally {
      setLoading(false)
    }
  }

  if (!canManage) return null

  return (
    <div className="flex flex-wrap gap-2">
      {!hasQueue && (
        <Dialog open={open === "setup"} onOpenChange={(v) => setOpen(v ? "setup" : null)}>
          <DialogTrigger render={<Button><Users className="size-4" /> Set up rotation</Button>} />
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Set up payout rotation</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Create the payout rotation queue. You can configure the mode, frequency and amount in the settings.
            </p>
            <Button onClick={createQueue} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Create rotation queue
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {hasQueue && (
        <Dialog open={open === "configure"} onOpenChange={(v) => setOpen(v ? "configure" : null)}>
          <DialogTrigger render={<Button variant="outline"><Settings2 className="size-4" /> Configure</Button>} />
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Payout configuration</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={pMode} onValueChange={(v) => { if (v) setPMode(v) }}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED_ORDER">Fixed order</SelectItem>
                    <SelectItem value="MANUAL_ORDER">Manual order</SelectItem>
                    <SelectItem value="RANDOM_DRAW">Random draw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => { if (v) setFrequency(v) }}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (leave empty to use collected pot)</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <div>
                  <p className="text-sm font-medium">Use collected pot</p>
                  <p className="text-xs text-muted-foreground">Payout equals the amount collected</p>
                </div>
                <Switch checked={useCollectedPot} onCheckedChange={setUseCollectedPot} />
              </div>
              <div className="space-y-2">
                <Label>Grace days</Label>
                <Input type="number" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Minimum approvals</Label>
                <Input type="number" value={minApprovals} onChange={(e) => setMinApprovals(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <div>
                  <p className="text-sm font-medium">Require all contributions confirmed</p>
                  <p className="text-xs text-muted-foreground">Block payout until every member has paid</p>
                </div>
                <Switch checked={requireConfirmed} onCheckedChange={setRequireConfirmed} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <div>
                  <p className="text-sm font-medium">Beneficiary confirmation</p>
                  <p className="text-xs text-muted-foreground">Require member to confirm receipt</p>
                </div>
                <Switch checked={requireBeneficiary} onCheckedChange={setRequireBeneficiary} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <div>
                  <p className="text-sm font-medium">Allow position swaps</p>
                  <p className="text-xs text-muted-foreground">Admins can reorder the queue</p>
                </div>
                <Switch checked={allowSwap} onCheckedChange={setAllowSwap} />
              </div>
              <Button onClick={saveConfig} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Settings2 className="size-4" />} Save configuration
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {hasQueue && mode === "RANDOM_DRAW" && (
        <Dialog open={open === "draw"} onOpenChange={(v) => setOpen(v ? "draw" : null)}>
          <DialogTrigger render={<Button variant="outline" className="text-purple-700"><Shuffle className="size-4" /> Run draw</Button>} />
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Run random draw</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will rebuild the queue with a randomly selected beneficiary first. Members who have already been paid will be excluded.
            </p>
            <Button onClick={runDraw} disabled={loading} variant="outline" className="text-purple-700">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Shuffle className="size-4" />} Run the draw
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
