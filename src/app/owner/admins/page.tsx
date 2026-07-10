"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, UserCog, Plus, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

const ROLE_BADGES: Record<string, string> = {
  SUPER_ADMIN: "border-purple-200 bg-purple-50 text-purple-700",
  ADMIN: "border-blue-200 bg-blue-50 text-blue-700",
  SUPPORT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FINANCE: "border-amber-200 bg-amber-50 text-amber-700",
}

export default function OwnerAdminsPage() {
  const [admins, setAdmins] = useState<{ id: string; userId: string; role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string; user: { id: string; name: string | null; email: string; image: string | null } }[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("ADMIN")
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<{ type: string; id: string; name: string } | null>(null)

  async function fetchAdmins() {
    setLoading(true)
    try { const r = await fetch("/api/owner/admins"); const d = await r.json(); setAdmins(Array.isArray(d) ? d as { id: string; userId: string; role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string; user: { id: string; name: string | null; email: string; image: string | null } }[] : []) } catch { setAdmins([]) }
    setLoading(false)
  }

  useEffect(() => { fetchAdmins() }, [])

  async function addAdmin() {
    if (!email) return; setAdding(true)
    try {
      const r = await fetch("/api/owner/admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), role }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed") } else { toast.success("Admin added"); setEmail(""); setRole("ADMIN"); fetchAdmins() }
    } catch { toast.error("Failed to add admin") }
    setAdding(false)
  }

  async function changeRole(adminId: string, newRole: string) {
    try {
      const r = await fetch(`/api/owner/admins/${adminId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: newRole }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed") } else { toast.success("Role updated"); fetchAdmins() }
    } catch { toast.error("Failed") }
  }

  async function toggleActive(adminId: string, currentlyActive: boolean, name: string) {
    if (currentlyActive) { setConfirm({ type: "deactivate", id: adminId, name }); return }
    try {
      const r = await fetch(`/api/owner/admins/${adminId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed") } else { toast.success("Activated"); fetchAdmins() }
    } catch { toast.error("Failed") }
  }

  async function confirmDeactivate() {
    if (!confirm) return
    try {
      const r = await fetch(`/api/owner/admins/${confirm.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed") } else { toast.success("Deactivated"); fetchAdmins() }
    } catch { toast.error("Failed") }
    setConfirm(null)
  }

  async function removeAccess(adminId: string, name: string) {
    setConfirm({ type: "remove", id: adminId, name })
  }

  async function confirmRemove() {
    if (!confirm) return
    try {
      const r = await fetch(`/api/owner/admins/${confirm.id}`, { method: "DELETE" })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed") } else { toast.success("Access removed"); fetchAdmins() }
    } catch { toast.error("Failed") }
    setConfirm(null)
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Admin Management</h1><p className="text-muted-foreground">Manage platform staff and administrators</p></div>

      {/* Safety rules */}
      <Card className="rounded-2xl border-amber-200 bg-amber-50/30"><CardContent className="p-4 flex items-start gap-3 text-sm">
        <AlertTriangle className="size-4 mt-0.5 text-amber-600 shrink-0" />
        <div><p className="font-medium text-amber-800">Safety Rules</p><p className="text-amber-700 text-xs">Only SUPER_ADMINs can manage admins. You cannot deactivate or remove yourself. The last active SUPER_ADMIN cannot be demoted or removed.</p></div>
      </CardContent></Card>

      {/* Add admin */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base"><Plus className="size-4 inline mr-1" /> Add Admin</CardTitle></CardHeader><CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" className="rounded-xl flex-1" />
          <Select value={role} onValueChange={(v: string | null) => { if (v) setRole(v) }}>
            <SelectTrigger className="rounded-xl w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{["SUPER_ADMIN", "ADMIN", "SUPPORT", "FINANCE"].map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={addAdmin} disabled={adding || !email.trim()} className="rounded-xl bg-brand hover:bg-brand-600">{adding ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4 mr-1" /> Add</>}</Button>
        </div>
      </CardContent></Card>

      {/* Admins list */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base"><UserCog className="size-4 inline mr-1" /> Administrators ({admins.length})</CardTitle></CardHeader><CardContent className="p-0">
        {loading ? <div className="p-6 text-center"><Loader2 className="size-4 animate-spin mx-auto" /></div> : (
          <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs font-medium text-muted-foreground"><th className="p-3 pl-4">User</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Last Login</th><th className="p-3">Created</th><th className="p-3 pr-4">Actions</th></tr></thead>
            <tbody>{admins.map((a) => (
              <tr key={a.id} className="border-b hover:bg-muted/30">
                <td className="p-3 pl-4">
                  <Link href={`/owner/users/${a.user?.id}`} className="hover:underline"><span className="font-medium">{a.user?.name || "—"}</span></Link>
                  <p className="text-xs text-muted-foreground">{a.user?.email}</p>
                </td>
                <td className="p-3">
                  <Select value={a.role} onValueChange={(v: string | null) => { if (v && v !== a.role) changeRole(a.id, v) }}>
                    <SelectTrigger className={`rounded-xl h-7 w-36 text-xs ${ROLE_BADGES[a.role] || ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{["SUPER_ADMIN", "ADMIN", "SUPPORT", "FINANCE"].map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="p-3"><Badge variant={a.isActive ? "default" : "secondary"} className={`text-[10px] ${a.isActive ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}`}>{a.isActive ? "Active" : "Inactive"}</Badge></td>
                <td className="p-3 text-xs text-muted-foreground">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : "Never"}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="p-3 pr-4 space-x-1.5">
                  <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => toggleActive(a.id, a.isActive, a.user?.name || a.user?.email)}>{a.isActive ? "Deactivate" : "Activate"}</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-red-600 hover:bg-red-50" onClick={() => removeAccess(a.id, a.user?.name || a.user?.email)}>Remove</Button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </CardContent></Card>

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirm(null)}>
          <div className="bg-card border rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold">{confirm.type === "deactivate" ? "Deactivate Admin" : "Remove Admin Access"}</p>
            <p className="text-sm text-muted-foreground">
              {confirm.type === "deactivate" ? `Deactivate admin access for ${confirm.name}? They will no longer be able to access the owner panel.` : `Permanently remove admin access for ${confirm.name}? This cannot be undone without re-adding them.`}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button size="sm" className="rounded-xl bg-red-600 hover:bg-red-700" onClick={confirm.type === "deactivate" ? confirmDeactivate : confirmRemove}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
