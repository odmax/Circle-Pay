"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FolderKanban, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export default function NewProjectPage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = use(params)
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [targetAmount, setTargetAmount] = useState("")
  const [type, setType] = useState("general")
  const [slug, setSlug] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    setSaving(true)
    try {
      const projectSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      const r = await fetch(`/api/circles/${circleId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: projectSlug, description: description || undefined, type, targetAmount: targetAmount ? Number(targetAmount) : undefined }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed to create project"); setSaving(false); return }
      toast.success("Project created")
      router.push(`/circles/${circleId}/projects/${d.id}`)
    } catch { toast.error("Failed"); setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button render={<Link href={`/circles/${circleId}/projects`} />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">New Project</h1></div>
      </div>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base flex items-center gap-2"><FolderKanban className="size-4" /> Project Details</CardTitle></CardHeader><CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="rounded-xl" required />
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (auto-generated from name)" className="rounded-xl" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded-xl" rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Input value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} type="number" step="0.01" placeholder="Target amount (R)" className="rounded-xl" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">{["general","investment","fundraising","savings","event","purchase","other"].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select>
          </div>
          <Button type="submit" disabled={saving || !name} className="w-full rounded-xl bg-brand hover:bg-brand-600">{saving ? <Loader2 className="size-4 animate-spin" /> : "Create Project"}</Button>
        </form>
      </CardContent></Card>
    </div>
  )
}
