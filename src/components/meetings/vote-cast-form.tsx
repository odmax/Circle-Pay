"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface VoteCastFormProps {
  circleId: string
  voteId: string
  voteType: string
  options: { id: string; text: string }[]
  alreadyVoted: boolean
  isOpen: boolean
}

export function VoteCastForm({ circleId, voteId, voteType, options, alreadyVoted, isOpen }: VoteCastFormProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const isRanked = voteType === "RANKED_CHOICE"
  const isYesNo = voteType === "YES_NO"

  function toggle(optionId: string) {
    if (isYesNo || isRanked) return
    setSelected((prev) => (prev.includes(optionId) ? prev.filter((o) => o !== optionId) : [...prev, optionId]))
  }

  function selectSingle(optionId: string) {
    setSelected([optionId])
  }

  async function submit() {
    if (selected.length === 0) {
      toast.error("Select at least one option")
      return
    }
    const selections = selected.map((optionId, i) => (isRanked ? { optionId, rank: i + 1 } : { optionId }))
    setLoading(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/votes/${voteId}/cast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to cast vote")
      }
      toast.success("Vote cast")
      window.location.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cast vote")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null
  if (alreadyVoted) {
    return <p className="text-sm text-muted-foreground">You have already voted in this vote.</p>
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <Button
          key={opt.id}
          variant={selected.includes(opt.id) ? "default" : "outline"}
          className="w-full justify-start rounded-xl"
          onClick={() => (isRanked || isYesNo ? selectSingle(opt.id) : toggle(opt.id))}
        >
          {isRanked && selected.includes(opt.id) ? `${selected.indexOf(opt.id) + 1}. ` : ""}
          {opt.text}
        </Button>
      ))}
      <Button onClick={submit} disabled={loading || selected.length === 0} className="rounded-xl">
        {loading ? "Submitting…" : "Cast Vote"}
      </Button>
    </div>
  )
}
