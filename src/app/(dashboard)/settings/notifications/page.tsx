"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Save, Loader2, Bell, PiggyBank, ShoppingBag, Target, Wallet, Calendar, BarChart3, MessageCircle, Megaphone, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const CATEGORIES = [
  { key: "contributions", label: "Contributions", desc: "Payment plans, contributions, reminders", icon: PiggyBank },
  { key: "expenses", label: "Expenses", desc: "New expenses, splits, settlements", icon: ShoppingBag },
  { key: "goals", label: "Goals", desc: "Goal creation, allocations, completions", icon: Target },
  { key: "wallet", label: "Wallet", desc: "Wallet transactions, approvals", icon: Wallet },
  { key: "events", label: "Events", desc: "Event creation, reminders, RSVPs", icon: Calendar },
  { key: "polls", label: "Polls", desc: "New polls, votes, results", icon: BarChart3 },
  { key: "support", label: "Support", desc: "Ticket updates, replies", icon: MessageCircle },
  { key: "broadcasts", label: "Broadcasts", desc: "Platform announcements", icon: Megaphone },
  { key: "system", label: "System", desc: "Security, billing, account updates", icon: Settings },
]

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/settings/notifications").then((r) => r.json()).then(setPrefs).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch("/api/settings/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) })
      if (!r.ok) { toast.error("Failed to save") } else { toast.success("Preferences saved"); router.refresh() }
    } catch { toast.error("Failed to save") }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Notification Preferences</h1><p className="text-muted-foreground">Choose which notifications you want to receive</p></div>
        <Button onClick={save} disabled={saving} className="rounded-xl bg-brand hover:bg-brand-600">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />} Save</Button>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          return (
            <Card key={cat.key} className="rounded-2xl">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted"><Icon className="size-4 text-muted-foreground" /></div>
                  <div><p className="text-sm font-medium">{cat.label}</p><p className="text-xs text-muted-foreground">{cat.desc}</p></div>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs[cat.key] ?? true}
                  onClick={() => setPrefs((p) => ({ ...p, [cat.key]: !(p[cat.key] ?? true) }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${prefs[cat.key] ?? true ? "bg-brand" : "bg-muted-foreground/20"}`}
                >
                  <span className={`inline-block size-4 rounded-full bg-white transition-transform ${prefs[cat.key] ?? true ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
