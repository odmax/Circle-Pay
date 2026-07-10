"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"

export function OwnerUserCircleManager({ userId, circles, allCircles, canManage }: { userId: string; circles: any[]; allCircles: { id: string; name: string; type: string }[]; canManage: boolean }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedCircle, setSelectedCircle] = useState("")
  const [selectedRole, setSelectedRole] = useState("MEMBER")
  const [loading, setLoading] = useState<{ action: string; id?: string } | null>(null)

  async function removeFromCircle(circleId: string, circleName: string) {
    setLoading({ action: "remove", id: circleId })
    const res = await fetch(`/api/owner/users/${userId}/circles/${circleId}`, { method: "DELETE" })
    if (!res.ok) { const err = await res.json(); toast.error(err.error); setLoading(null); return }
    toast.success(`Removed from ${circleName}`)
    router.refresh()
  }

  async function changeRole(circleId: string, role: string) {
    setLoading({ action: "role", id: circleId })
    const res = await fetch(`/api/owner/users/${userId}/circles/${circleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) })
    if (!res.ok) { const err = await res.json(); toast.error(err.error); setLoading(null); return }
    toast.success("Role updated")
    router.refresh()
  }

  async function addToCircle() {
    if (!selectedCircle) return
    setLoading({ action: "add" })
    const res = await fetch(`/api/owner/users/${userId}/circles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ circleId: selectedCircle, role: selectedRole }) })
    if (!res.ok) { const err = await res.json(); toast.error(err.error); setLoading(null); return }
    toast.success("Added to circle")
    setAddOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {circles.map((m: any) => (
        <div key={m.id} className="flex items-center gap-2 justify-between text-sm border-b pb-2">
          <Link href={`/owner/circles/${m.circle.id}`} className="hover:underline truncate flex-1">{m.circle.name}</Link>
          <Badge variant="outline" className="text-[10px]">{m.circle.type}</Badge>
          {canManage ? (
            <Select value={m.role} onValueChange={(v: string | null) => { if (v) changeRole(m.circle.id, v) }}>
              <SelectTrigger className="h-7 w-24 rounded-lg text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="MEMBER">Member</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent>
            </Select>
          ) : <Badge variant="outline">{m.role}</Badge>}
          {canManage && (
            <Button size="sm" variant="ghost" className="text-red-500 text-xs h-7" onClick={() => removeFromCircle(m.circle.id, m.circle.name)} disabled={!!loading}>
              {loading?.id === m.circle.id ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
            </Button>
          )}
        </div>
      ))}
      {canManage && !addOpen && (
        <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => setAddOpen(true)}><Plus className="size-3 mr-1" /> Add Circle</Button>
      )}
      {canManage && addOpen && (
        <div className="flex gap-2 items-center">
            <Select value={selectedCircle} onValueChange={(v: string | null) => { if (v) setSelectedCircle(v) }}>
            <SelectTrigger className="h-7 rounded-lg text-xs flex-1"><SelectValue placeholder="Select circle" /></SelectTrigger>
            <SelectContent>{allCircles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
            <Select value={selectedRole} onValueChange={(v: string | null) => { if (v) setSelectedRole(v) }}>
            <SelectTrigger className="h-7 w-24 rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="MEMBER">Member</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent>
          </Select>
          <Button size="sm" className="rounded-xl text-xs h-7" onClick={addToCircle} disabled={loading?.action === "add"}>
            {loading?.action === "add" ? <Loader2 className="size-3 animate-spin" /> : "Add"}
          </Button>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAddOpen(false)}><X className="size-3" /></Button>
        </div>
      )}
    </div>
  )
}
