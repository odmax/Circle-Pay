"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AcceptConstitutionButton({
  circleId,
  versionId,
  accepted,
}: {
  circleId: string
  versionId: string
  accepted: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  if (accepted) {
    return (
      <Button variant="outline" disabled className="rounded-xl">
        <Check className="size-3.5 mr-1" /> Accepted
      </Button>
    )
  }
  async function accept() {
    setBusy(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/constitution/versions/${versionId}/accept`, { method: "POST" })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j.error || "Failed to accept")
      } else {
        toast.success("Constitution accepted")
        router.refresh()
      }
    } catch {
      toast.error("Failed to accept")
    }
    setBusy(false)
  }
  return (
    <Button onClick={accept} disabled={busy} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
      {busy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Check className="size-3.5 mr-1" />}
      Accept
    </Button>
  )
}

export function PublishActivateActions({
  circleId,
  versionId,
  status,
  canPublish,
}: {
  circleId: string
  versionId: string
  status: string
  canPublish: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function run(action: "publish" | "activate") {
    setBusy(action)
    try {
      const r = await fetch(`/api/circles/${circleId}/constitution/versions/${versionId}/${action}`, { method: "POST" })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j.error || `Failed to ${action}`)
      } else {
        toast.success(action === "publish" ? "Version published" : "Version activated")
        router.refresh()
      }
    } catch {
      toast.error(`Failed to ${action}`)
    }
    setBusy(null)
  }

  if (!canPublish) return null
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <Button onClick={() => run("publish")} disabled={busy !== null} className="rounded-xl">
          {busy === "publish" && <Loader2 className="size-3.5 mr-1 animate-spin" />} Publish
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button onClick={() => run("activate")} disabled={busy !== null} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          {busy === "activate" && <Loader2 className="size-3.5 mr-1 animate-spin" />} Activate
        </Button>
      )}
    </div>
  )
}

export function NewDraftDialog({
  circleId,
  title,
  preamble,
}: {
  circleId: string
  title: string
  preamble: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draftTitle, setDraftTitle] = useState(`${title} v2`)
  const [draftPreamble, setDraftPreamble] = useState(preamble ?? "")

  async function create() {
    setBusy(true)
    try {
      const content = { clauses: [] }
      const r = await fetch(`/api/circles/${circleId}/constitution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title: draftTitle, preamble: draftPreamble }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j.error || "Failed to create draft")
      } else {
        toast.success("Draft created")
        setOpen(false)
        router.refresh()
      }
    } catch {
      toast.error("Failed to create draft")
    }
    setBusy(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-xl" />}>New Draft</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New constitution draft</DialogTitle>
          <DialogDescription>Create a new version to iterate on the governing rules.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Preamble</Label>
            <Textarea value={draftPreamble} onChange={(e) => setDraftPreamble(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <DialogTrigger render={<Button variant="outline" />}>Cancel</DialogTrigger>
          <Button onClick={create} disabled={busy}>
            {busy && <Loader2 className="size-3.5 mr-1 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
