"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { CURRENCIES } from "@/lib/constants"

export function ProfileForm({
  profile,
}: {
  profile: { name: string | null; phone: string | null; currency: string }
}) {
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const { update } = useSession()

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const data = {
      name: form.get("name") as string,
      phone: (form.get("phone") as string) || undefined,
      currency: form.get("currency") as string,
    }
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const err = await res.json(); toast.error(err.error || "Failed"); return }
      toast.success("Profile updated!")
      await update()
      router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setSaving(false) }
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Edit Profile</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Full Name</Label>
            <Input id="p-name" name="name" defaultValue={profile.name || ""} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-phone">Phone Number</Label>
            <Input id="p-phone" name="phone" defaultValue={profile.phone || ""} placeholder="+2348012345678" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Preferred Currency</Label>
            <Select name="currency" defaultValue={profile.currency}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving} className="rounded-xl bg-brand hover:bg-brand-600">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
