"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCircleTypeConfig } from "@/lib/circle-types"
import { CURRENCIES } from "@/lib/constants"
import { toast } from "sonner"

export function ManageCircleForm({
  circle,
}: {
  circle: {
    id: string
    name: string
    description: string | null
    currency: string
    type: string
    settings: Record<string, unknown> | null
  }
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(circle.name)
  const [description, setDescription] = useState(circle.description || "")
  const [selectedCurrency, setSelectedCurrency] = useState(circle.currency)
  const [extraValues, setExtraValues] = useState<Record<string, unknown>>(circle.settings || {})

  const typeConfig = getCircleTypeConfig(circle.type)

  function setExtra(key: string, value: unknown) {
    setExtraValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const settings = { ...typeConfig.defaultSettings, ...extraValues }
    try {
      const res = await fetch(`/api/circles/${circle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, currency: selectedCurrency, settings }),
      })
      if (!res.ok) { const err = await res.json(); toast.error(err.error || "Failed to save"); return }
      toast.success("Circle updated!")
      router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setSaving(false) }
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Manage Circle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="m-name">Circle Name</Label>
          <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="m-desc">Description</Label>
          <Input id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
            <Select value={selectedCurrency} onValueChange={(v) => { if (v) setSelectedCurrency(v) }}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
          <p className="mb-3 text-sm font-medium">{typeConfig.label} Settings</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {typeConfig.setupFields.map((field) => (
              <div key={field.key} className={field.type === "toggle" ? "flex items-center justify-between gap-2 sm:col-span-2" : "space-y-1.5"}>
                {field.type === "toggle" ? (
                  <>
                    <Label className="text-sm">{field.label}</Label>
                    <Switch checked={!!extraValues[field.key]} onCheckedChange={(v) => setExtra(field.key, v)} />
                  </>
                ) : field.type === "select" ? (
                  <>
                    <Label className="text-xs">{field.label}</Label>
                    <Select value={(extraValues[field.key] as string) || ""} onValueChange={(v) => setExtra(field.key, v)}>
                      <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder={field.placeholder || "Select"} /></SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      type={field.type === "currency" || field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      value={(extraValues[field.key] as string) || ""}
                      onChange={(e) => setExtra(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="rounded-xl h-9 text-sm"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-brand hover:bg-brand-600">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  )
}
