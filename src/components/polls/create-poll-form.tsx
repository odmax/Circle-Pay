"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"

export function CreatePollForm({ circleId }: { circleId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [options, setOptions] = useState(["", ""])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true)
    const form = new FormData(e.currentTarget)
    const opts = options.filter((o) => o.trim())
    if (opts.length < 2) { toast.error("At least 2 options required"); setSaving(false); return }
    try {
      const res = await fetch(`/api/circles/${circleId}/polls`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.get("title"), description: form.get("description"), type: form.get("type"), options: opts }),
      })
      if (!res.ok) { toast.error("Failed"); return }
      toast.success("Poll created!"); setOpen(false); setOptions(["", ""]); router.refresh()
    } catch { toast.error("Something went wrong") }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-xl bg-brand hover:bg-brand-600" />}><Plus className="size-4 mr-1" /> New Poll</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Poll</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input name="title" required className="rounded-xl" placeholder="Poll question" />
          <Textarea name="description" className="rounded-xl" rows={2} placeholder="Optional description" />
          <div className="grid grid-cols-2 gap-3">
            <Select name="type" defaultValue="YES_NO"><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="YES_NO">Yes / No</SelectItem><SelectItem value="MULTIPLE_CHOICE">Multiple Choice</SelectItem><SelectItem value="APPROVAL">Approval</SelectItem></SelectContent></Select>
            <Input name="closesAt" type="datetime-local" className="rounded-xl" placeholder="Closes at (optional)" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Options</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-1">
                <Input value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n) }} className="rounded-xl" placeholder={`Option ${i + 1}`} />
                {options.length > 2 && <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setOptions(options.filter((_, j) => j !== i))}><X className="size-3" /></Button>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, ""])} className="rounded-xl"><Plus className="size-3 mr-1" /> Add Option</Button>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="rounded-xl bg-brand hover:bg-brand-600">{saving ? <Loader2 className="size-4 animate-spin" /> : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
