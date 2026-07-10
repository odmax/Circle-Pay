"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { createCircleSchema } from "@/lib/validations/circles"
import { CURRENCIES, CIRCLE_TYPES } from "@/lib/constants"
import { getCircleTypeConfig } from "@/lib/circle-types"
import { toast } from "sonner"

const PREVIEW_ITEMS: Record<string, string[]> = {
  STOKVEL: ["Monthly contribution tracker", "Stokvel pool goal", "Payout schedule", "Member dashboard"],
  HOUSEMATE: ["Rent tracker", "Utility categories", "Grocery tracking", "Shared balance sheet"],
  TRAVEL: ["Trip fund goal", "Travel budget tracker", "Expense categories", "Countdown to departure"],
  WEDDING: ["Wedding fund goal", "Vendor categories", "Budget tracker", "Expense tracking"],
  SAVINGS: ["Savings goal", "Contribution plan", "Progress tracker", "Forecast widget"],
  FAMILY: ["Family fund goal", "Emergency fund", "Family expense categories", "Contribution plan"],
  CHURCH: ["Project goal", "Donation categories", "Project progress tracker", "Member dashboard"],
  INVESTMENT: ["Investment goal", "Monthly contribution plan", "Portfolio tracker", "Risk profile"],
}

export function CreateCircleForm() {
  const router = useRouter()

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createCircleSchema),
    defaultValues: { type: "CUSTOM" as const, currency: "NGN" as const },
  })

  const selectedType = watch("type")
  const selectedCurrency = watch("currency")
  const typeConfig = getCircleTypeConfig(selectedType as string)
  const [extraValues, setExtraValues] = useState<Record<string, unknown>>({})
  const [prevType, setPrevType] = useState(selectedType)

  if (selectedType !== prevType) {
    setPrevType(selectedType)
    setExtraValues({})
  }

  function setExtra(key: string, value: unknown) {
    setExtraValues((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(data: Record<string, unknown>) {
    const settings = { ...typeConfig.defaultSettings, ...extraValues }
    for (const field of typeConfig.setupFields) {
      const val = extraValues[field.key]
      if (val !== undefined && val !== "" && val !== false) settings[field.key] = val
    }
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, description: data.description, type: data.type, currency: data.currency, settings }),
      })
      if (!res.ok) { const err = await res.json(); toast.error(err.error || "Failed to create circle"); return }
      const circle = await res.json()
      toast.success("Circle created!")
      router.push(`/circles/${circle.id}`)
    } catch { toast.error("Something went wrong. Please try again.") }
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-lg">Create a Circle</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Circle Name</Label>
            <Input id="name" placeholder="e.g. Family Savings 2026" className="rounded-xl" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{String(errors.name.message)}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" placeholder="What's this circle about?" className="rounded-xl" {...register("description")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Circle Type</Label>
              <Select value={selectedType as string} onValueChange={(v) => { if (v) setValue("type", v as typeof selectedType) }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {CIRCLE_TYPES.map((ct) => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={selectedCurrency as string} onValueChange={(v) => { if (v) setValue("currency", v as typeof selectedCurrency) }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select currency" /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type-specific setup fields */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="mb-3 text-sm font-medium">{typeConfig.label} Setup</p>
            <p className="mb-3 text-xs text-muted-foreground">{typeConfig.description}</p>
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
                      <Label className="text-xs">{field.label}{field.required ? " *" : ""}</Label>
                      <Input
                        type={field.type === "currency" || field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                        placeholder={field.placeholder}
                        value={(extraValues[field.key] as string) || ""}
                        onChange={(e) => setExtra(field.key, e.target.value)}
                        className="rounded-xl h-9 text-sm"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Template Preview */}
          {selectedType && selectedType !== "CUSTOM" && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/20 p-3">
              <p className="text-xs font-medium text-brand-800 mb-1">Circle Pay will set up:</p>
              <ul className="text-xs text-brand-700 space-y-0.5">
                {PREVIEW_ITEMS[selectedType as string]?.map((item: string, i: number) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-brand hover:bg-brand-600">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Create Circle"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
