"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Eye,
  Download,
  XCircle,
  RefreshCw,
  Search,
  Receipt,
  DollarSign,
  FileX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ReceiptStatusBadge } from "@/components/receipts/receipt-status-badge"
import { CIRCLE_PERMISSIONS } from "@/lib/permissions/circlePermissions"
import { useCirclePermissions } from "@/hooks/use-circle-permissions"

type ReceiptRow = {
  id: string
  receiptNumber: string
  type: string
  amount: unknown
  currency: string
  status: "ACTIVE" | "VOIDED" | "REPLACED"
  issuedAt: string
  transactionDate: string
  issuedTo: { id: string; name: string | null; email: string; image: string | null } | null
  issuedBy: { id: string; name: string | null; email: string; image: string | null } | null
}

type Stats = {
  totalReceipts: number
  totalAmount: number
  byStatus: { ACTIVE: number; VOIDED: number; REPLACED: number }
}

interface ReceiptsListManagerProps {
  circleId: string
  initialReceipts: ReceiptRow[]
  initialTotal: number
  stats: Stats
  currencySymbol: string
  userRole: string
}

const RECEIPT_TYPES = [
  { value: "all", label: "All Types" },
  { value: "CONTRIBUTION", label: "Contribution" },
  { value: "EXPENSE", label: "Expense" },
  { value: "SETTLEMENT", label: "Settlement" },
  { value: "WALLET_DEPOSIT", label: "Wallet Deposit" },
  { value: "WALLET_WITHDRAWAL", label: "Wallet Withdrawal" },
  { value: "WALLET_TRANSFER", label: "Wallet Transfer" },
  { value: "PROJECT_PAYMENT", label: "Project Payment" },
  { value: "GOAL_ALLOCATION", label: "Goal Allocation" },
  { value: "OTHER", label: "Other" },
]

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "VOIDED", label: "Voided" },
  { value: "REPLACED", label: "Replaced" },
]

const LIMIT = 25

export function ReceiptsListManager({
  circleId,
  initialReceipts,
  initialTotal,
  stats,
  currencySymbol,
  userRole,
}: ReceiptsListManagerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [receipts, setReceipts] = useState(initialReceipts)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "all")
  const [type, setType] = useState(searchParams.get("type") ?? "all")
  const [offset, setOffset] = useState(0)
  const [actingId, setActingId] = useState<string | null>(null)

  const perms = useCirclePermissions([] as never)
  const canAdjust = true

  const fetchReceipts = useCallback(
    async (newOffset: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (status !== "all") params.set("status", status)
        if (type !== "all") params.set("type", type)
        if (search) params.set("search", search)
        params.set("limit", String(LIMIT))
        params.set("offset", String(newOffset))

        const res = await fetch(
          `/api/circles/${circleId}/receipts?${params.toString()}`
        )
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        setReceipts(data.receipts)
        setTotal(data.total)
        setOffset(newOffset)
      } catch {
        toast.error("Failed to load receipts")
      } finally {
        setLoading(false)
      }
    },
    [circleId, status, type, search]
  )

  const handleFilterChange = (newStatus: string) => {
    setStatus(newStatus)
    setOffset(0)
    const params = new URLSearchParams()
    if (newStatus !== "all") params.set("status", newStatus)
    if (type !== "all") params.set("type", type)
    if (search) params.set("search", search)
    router.push(`/circles/${circleId}/receipts?${params.toString()}`)
    fetchReceipts(0)
  }

  const handleTypeChange = (newType: string) => {
    setType(newType)
    setOffset(0)
    fetchReceipts(0)
  }

  const handleSearch = () => {
    setOffset(0)
    fetchReceipts(0)
  }

  const handleDownloadPdf = async (receiptId: string) => {
    try {
      const res = await fetch(
        `/api/circles/${circleId}/receipts/${receiptId}/pdf`
      )
      if (!res.ok) throw new Error("Failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `receipt-${receiptId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded")
    } catch {
      toast.error("Failed to download PDF")
    }
  }

  const handleVoid = async (receiptId: string) => {
    const reason = prompt("Enter reason for voiding this receipt:")
    if (!reason) return
    setActingId(receiptId)
    try {
      const res = await fetch(
        `/api/circles/${circleId}/receipts/${receiptId}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed")
      }
      toast.success("Receipt voided")
      fetchReceipts(offset)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to void receipt")
    } finally {
      setActingId(null)
    }
  }

  const handleReplace = async (receiptId: string) => {
    const reason = prompt("Enter reason for replacing this receipt:")
    if (!reason) return
    setActingId(receiptId)
    try {
      const res = await fetch(
        `/api/circles/${circleId}/receipts/${receiptId}/replace`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed")
      }
      toast.success("Receipt replaced")
      fetchReceipts(offset)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to replace receipt")
    } finally {
      setActingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const currentPage = Math.floor(offset / LIMIT) + 1

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Receipts
            </CardTitle>
            <Receipt className="size-4 text-brand" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReceipts}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Amount
            </CardTitle>
            <DollarSign className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {currencySymbol}
              {stats.totalAmount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Voided
            </CardTitle>
            <FileX className="size-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stats.byStatus.VOIDED}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleFilterChange(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={(val) => { if (val !== null) handleTypeChange(val) }}>
            <SelectTrigger size="sm" className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECEIPT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search receipt #..."
              className="h-7 w-48 rounded-xl pl-8 text-sm"
            />
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-border/40">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading receipts...
            </div>
          ) : receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
                <Receipt className="size-6 text-muted-foreground" />
              </div>
              <h4 className="text-sm font-medium">No receipts found</h4>
              <p className="text-xs text-muted-foreground">
                Receipts are issued for confirmed contributions
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="p-3 pl-4">Receipt #</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Member</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b transition-colors hover:bg-muted/30 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/circles/${circleId}/receipts/${r.id}`
                        )
                      }
                    >
                      <td className="p-3 pl-4 font-mono text-xs font-medium">
                        {r.receiptNumber}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {r.type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="text-muted-foreground">
                          {r.issuedTo?.name ?? r.issuedTo?.email ?? "—"}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        {currencySymbol}
                        {Number(r.amount).toLocaleString()}
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
                                href={`/circles/${circleId}/receipts/${r.id}`}
                              />
                            }
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDownloadPdf(r.id)}
                          >
                            <Download className="size-3.5" />
                          </Button>
                          {r.status === "ACTIVE" && canAdjust && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleVoid(r.id)}
                                disabled={actingId === r.id}
                              >
                                <XCircle className="size-3.5 text-red-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleReplace(r.id)}
                                disabled={actingId === r.id}
                              >
                                <RefreshCw className="size-3.5 text-amber-600" />
                              </Button>
                            </>
                          )}
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

      {total > LIMIT && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => fetchReceipts(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
            >
              <ChevronLeft className="size-3.5" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => fetchReceipts(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
            >
              Next <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
