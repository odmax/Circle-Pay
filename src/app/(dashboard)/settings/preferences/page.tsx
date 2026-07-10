"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Save, Loader2, SunMoon, Maximize2, Globe, Eye, EyeOff, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

const WIDGETS = [
  { key: "circles", label: "My Circles", desc: "Circle cards" },
  { key: "totalPool", label: "Total Pool", desc: "Combined balance" },
  { key: "goals", label: "Goals", desc: "Active targets" },
  { key: "pending", label: "Pending", desc: "Outstanding contributions" },
  { key: "quickActions", label: "Quick Actions", desc: "Action buttons" },
  { key: "recentActivity", label: "Recent Activity", desc: "Latest events" },
  { key: "goalProgress", label: "Goal Progress", desc: "Overall progress bar" },
]

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/settings/preferences").then((r) => r.json()).then(setPrefs).finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const r = await fetch("/api/settings/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) })
      if (!r.ok) { toast.error("Failed to save") } else { toast.success("Preferences saved"); router.refresh() }
    } catch { toast.error("Failed") }
    setSaving(false)
  }

  function update(key: string, value: unknown) { setPrefs((p) => ({ ...p, [key]: value })) }
  function toggleWidget(key: string) {
    const widgets = (prefs.dashboardWidgets as string[]) || []
    update("dashboardWidgets", widgets.includes(key) ? widgets.filter((w) => w !== key) : [...widgets, key])
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Preferences</h1><p className="text-muted-foreground">Personalize your Circle Pay experience</p></div>
        <Button onClick={save} disabled={saving} className="rounded-xl bg-brand hover:bg-brand-600">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />} Save</Button>
      </div>

      {/* Display */}
      <Card className="rounded-2xl"><CardContent className="space-y-4 p-5">
        <h2 className="text-base font-semibold">Display</h2>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><SunMoon className="size-4 text-muted-foreground" /><span className="text-sm">Theme</span></div>
          <select value={prefs.theme as string || "system"} onChange={(e) => update("theme", e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
        </div>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Maximize2 className="size-4 text-muted-foreground" /><span className="text-sm">Compact Mode</span></div>
          <button role="switch" aria-checked={!!prefs.compactMode} onClick={() => update("compactMode", !prefs.compactMode)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${prefs.compactMode ? "bg-brand" : "bg-muted-foreground/20"}`}>
            <span className={`inline-block size-4 rounded-full bg-white transition-transform ${prefs.compactMode ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Globe className="size-4 text-muted-foreground" /><span className="text-sm">Default Currency</span></div>
          <select value={prefs.preferredCurrency as string || "ZAR"} onChange={(e) => update("preferredCurrency", e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm">{["ZAR","NGN","KES","GHS","USD","EUR","GBP"].map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2">{prefs.showOnboardingTips ? <Eye className="size-4 text-muted-foreground" /> : <EyeOff className="size-4 text-muted-foreground" />}<span className="text-sm">Show Onboarding Tips</span></div>
          <button role="switch" aria-checked={!!prefs.showOnboardingTips} onClick={() => update("showOnboardingTips", !prefs.showOnboardingTips)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${prefs.showOnboardingTips ? "bg-brand" : "bg-muted-foreground/20"}`}>
            <span className={`inline-block size-4 rounded-full bg-white transition-transform ${prefs.showOnboardingTips ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </CardContent></Card>

      {/* Dashboard Widgets */}
      <Card className="rounded-2xl"><CardContent className="space-y-4 p-5">
        <h2 className="text-base font-semibold">Dashboard Widgets</h2>
        <p className="text-xs text-muted-foreground">Choose which widgets appear on your dashboard.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {WIDGETS.map((w) => {
            const enabled = ((prefs.dashboardWidgets as string[]) || []).includes(w.key)
            return (
              <div key={w.key} onClick={() => toggleWidget(w.key)} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${enabled ? "border-brand-200 bg-brand-50/20" : "border-border/40 bg-card opacity-60"}`}>
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted"><Settings className="size-4 text-muted-foreground" /></div>
                <div className="flex-1"><p className="text-sm font-medium">{w.label}</p><p className="text-xs text-muted-foreground">{w.desc}</p></div>
                <div className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${enabled ? "border-brand bg-brand" : "border-muted-foreground/30"}`}>
                  {enabled && <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent></Card>
    </div>
  )
}
