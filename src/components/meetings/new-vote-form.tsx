"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

const TYPES = [
  { value: "YES_NO", label: "Yes / No" },
  { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { value: "RANKED_CHOICE", label: "Ranked choice" },
]

const CATEGORIES = [
  "GENERAL_MOTION",
  "CONSTITUTION_AMENDMENT",
  "NEW_MEMBER",
  "FINANCIAL",
  "PAYOUT_EXCEPTION",
  "PROJECT",
]

interface NewVoteFormProps {
  circleId: string
}

export function NewVoteForm({ circleId }: NewVoteFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [type, setType] = useState("YES_NO")
  const [options, setOptions] = useState<string[]>(["Yes", "No"])
  const [anonymous, setAnonymous] = useState(false)
  const [majorFinancial, setMajorFinancial] = useState(false)
  const [loading, setLoading] = useState(false)

  function setOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  }

  function addOption() {
    setOptions((prev) => [...prev, ""])
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    const cleaned = options.map((o) => o.trim()).filter(Boolean)
    if (cleaned.length === 0) {
      toast.error("At least one option is required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, motionCategory: category, type, options: cleaned, anonymous, majorFinancial }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create vote")
      }
      toast.success("Vote opened")
      router.push(`/circles/${circleId}/votes`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create vote")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Motion title" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is being decided?" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Motion category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label>Vote type</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Options</Label>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
            {options.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(i)}>×</Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOption}>Add option</Button>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Anonymous vote
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={majorFinancial} onChange={(e) => setMajorFinancial(e.target.checked)} />
          Major financial
        </label>
      </div>
      <Button type="submit" disabled={loading} className="rounded-xl">
        {loading ? "Opening…" : "Open Vote"}
      </Button>
    </form>
  )
}
