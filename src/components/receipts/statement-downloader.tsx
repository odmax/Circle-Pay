"use client"

import { useState } from "react"
import { Download, FileText, Calendar } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

interface StatementDownloaderProps {
  circleId: string
  members: { id: string; name: string }[]
  currencySymbol: string
}

export function StatementDownloader({
  circleId,
  members,
  currencySymbol,
}: StatementDownloaderProps) {
  const [statementType, setStatementType] = useState("circle")
  const [memberId, setMemberId] = useState("")
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return first.toISOString().split("T")[0]
  })
  const [toDate, setToDate] = useState(() => {
    const now = new Date()
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return last.toISOString().split("T")[0]
  })
  const [format, setFormat] = useState("json")
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (statementType === "member" && !memberId) {
      toast.error("Please select a member")
      return
    }

    setLoading(true)
    try {
      let url: string

      if (statementType === "circle") {
        url = `/api/circles/${circleId}/statements/circle?from=${fromDate}&to=${toDate}&format=${format}`
      } else if (statementType === "member") {
        url = `/api/circles/${circleId}/statements/member/${memberId}?from=${fromDate}&to=${toDate}&format=${format}`
      } else {
        toast.error("Contribution plan statement coming soon")
        setLoading(false)
        return
      }

      if (format === "json") {
        const res = await fetch(url)
        if (!res.ok) throw new Error("Failed to fetch statement")
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        })
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = `statement-${statementType}-${fromDate}-to-${toDate}.json`
        a.click()
        URL.revokeObjectURL(blobUrl)
        toast.success("Statement downloaded")
      } else {
        const a = document.createElement("a")
        a.href = url
        a.target = "_blank"
        a.download = `statement-${statementType}-${fromDate}-to-${toDate}.pdf`
        a.click()
        toast.success("PDF statement opened")
      }
    } catch {
      toast.error("Failed to download statement")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Download Statement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Statement Type</Label>
          <div className="flex gap-2">
            {[
              { value: "circle", label: "Circle Statement" },
              { value: "member", label: "Member Statement" },
              { value: "plan", label: "Plan Statement" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatementType(opt.value)}
                className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                  statementType === opt.value
                    ? "border-brand bg-brand-50 text-brand font-medium"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {statementType === "member" && (
          <div className="space-y-2">
            <Label>Select Member</Label>
            <Select value={memberId} onValueChange={(val) => { if (val !== null) setMemberId(val) }}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from-date">From</Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to-date">To</Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Format</Label>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat("json")}
              className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                format === "json"
                  ? "border-brand bg-brand-50 text-brand font-medium"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              JSON
            </button>
            <button
              onClick={() => setFormat("pdf")}
              className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                format === "pdf"
                  ? "border-brand bg-brand-50 text-brand font-medium"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              PDF
            </button>
          </div>
        </div>

        <Separator />

        <Button
          onClick={handleDownload}
          disabled={loading || statementType === "plan"}
          className="w-full rounded-xl bg-brand hover:bg-brand-600"
        >
          <Download className="size-4 mr-1.5" />
          {loading ? "Generating..." : "Download Statement"}
        </Button>
      </CardContent>
    </Card>
  )
}
