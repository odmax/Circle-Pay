"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
          confirmPassword: form.get("confirmPassword"),
        }),
      })
      if (!res.ok) { const err = await res.json(); toast.error(err.error || "Failed"); return }
      toast.success("Password changed!")
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setSaving(false) }
  }

  if (!hasPassword) {
    return (
      <Card className="rounded-2xl border-border/40 opacity-70">
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Password login not enabled for this account</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your account was created via Google. Add a password to enable email login.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Change Password</CardTitle>
        <CardDescription>Update your login password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-current">Current Password</Label>
            <Input id="cp-current" name="currentPassword" type="password" className="rounded-xl" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">New Password</Label>
            <Input id="cp-new" name="newPassword" type="password" placeholder="Min. 8 chars, upper + lower + number" className="rounded-xl" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">Confirm Password</Label>
            <Input id="cp-confirm" name="confirmPassword" type="password" className="rounded-xl" required />
          </div>
          <Button type="submit" disabled={saving} className="rounded-xl bg-brand hover:bg-brand-600">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Change Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
