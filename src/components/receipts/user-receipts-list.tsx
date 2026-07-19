"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, Download, Search, Receipt } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ReceiptStatusBadge } from "@/components/receipts/receipt-status-badge"

type UserReceipt = {
  id: string
  receiptNumber: string
  type: string
  amount: unknown
  currency: string
  status: "ACTIVE" | "VOIDED" | "REPLACED"
  issuedAt: string
  circle: { id: string; name: string }
  issuedBy: { id: string; name: string | null; email: string } | null
}

interface UserReceiptsListProps {
  receipts: UserReceipt[]
}

export function UserReceiptsList({ receipts }: UserReceiptsListProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filterCircle, setFilterCircle] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  const circles = Array.from(
    new Map(receipts.map((r) => [r.circle.id, r.circle])).values()
  )

  const filtered = receipts.filter((r) => {
    if (search && !r.receiptNumber.toLowerCase().includes(search.toLowerCase()))
      return false
    if (filterCircle !== "all" && r.circle.id !== filterCircle) return false
    if (filterStatus !== "all" && r.status !== filterStatus) return false
    return true
  })

  const handleDownloadPdf = async (receipt: UserReceipt) => {
    try {
      const res = await fetch(
        `/api/circles/${receipt.circle.id}/receipts/${receipt.id}/pdf`
      )
      if (!res.ok) throw new Error("Failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `receipt-${receipt.receiptNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded")
    } catch {
      toast.error("Failed to download PDF")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt number..."
            className="h-8 rounded-xl pl-8 text-sm"
          />
        </div>
        <select
          value={filterCircle}
          onChange={(e) => setFilterCircle(e.target.value)}
          className="h-8 rounded-xl border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="all">All Circles</option>
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 rounded-xl border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="all">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="VOIDED">Voided</option>
          <option value="REPLACED">Replaced</option>
        </select>
      </div>

      <Card className="rounded-2xl border-border/40">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                <Receipt className="size-6 text-muted-foreground" />
              </div>
              <h4 className="text-sm font-medium">No receipts found</h4>
              <p className="text-xs text-muted-foreground">
                You will receive receipts for confirmed contributions
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="p-3 pl-4">Circle</th>
                    <th className="p-3">Receipt #</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b transition-colors hover:bg-muted/30 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/circles/${r.circle.id}/receipts/${r.id}`
                        )
                      }
                    >
                      <td className="p-3 pl-4 font-medium">{r.circle.name}</td>
                      <td className="p-3 font-mono text-xs">{r.receiptNumber}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {r.type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono">
                        {r.currency} {Number(r.amount).toLocaleString()}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(r.issuedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <ReceiptStatusBadge status={r.status} />
                      </td>
                      <td className="p-3 pr-4">
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            render={
                              <Link
                                href={`/circles/${r.circle.id}/receipts/${r.id}`}
                              />
                            }
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDownloadPdf(r)}
                          >
                            <Download className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
