"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Loader2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function OwnerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true)
    const result = await signIn("credentials", { email, password, redirect: false })
    if (result?.error) { setError("Invalid email or password"); setLoading(false); return }

    // First try to bootstrap via POST (creates SUPER_ADMIN if email matches OWNER_EMAIL)
    await fetch("/api/owner/bootstrap", { method: "POST" }).catch(() => {})
    // Then check access via GET
    const check = await fetch("/api/owner/bootstrap")
    const data = await check.json()
    if (!data.ownerExists) { setError("This account does not have owner/admin access."); setLoading(false); return }

    router.push("/owner")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md rounded-2xl border-amber-200">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-amber-500 text-white"><Shield className="size-6" /></div>
          <CardTitle className="text-xl">Owner Access</CardTitle>
          <CardDescription>Circle Pay platform administration</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" placeholder="admin@example.com" required /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl" required /></div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
