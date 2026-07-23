"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Receipt, Search, Filter, MoreHorizontal, Edit, Trash2,
  Send, CheckCircle2, XCircle, Clock, Copy, AlertTriangle, DollarSign,
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, BarChart3, Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
  formatCurrency, formatDate, EXPENSE_STATUS_COLORS, EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, BUDGET_STATUS_COLORS,
  OVER_BUDGET_POLICIES,
} from "../types"
import type { ExpenseData, BudgetCategoryData, CircleData, ExpenseDashboardData, BudgetDashboardData, VendorData } from "../types"

interface ExpensesTabProps {
  circle: CircleData
  circleId: string
  projectId: string
}

export function ExpensesTab({ circle, circleId, projectId }: ExpensesTabProps) {
  const symbol = circle?.currency || "ZAR"
  const [view, setView] = useState<"expenses" | "budget">("expenses")
  const [loading, setLoading] = useState(true)
  const [expenseData, setExpenseData] = useState<ExpenseDashboardData | null>(null)
  const [budgetData, setBudgetData] = useState<BudgetDashboardData | null>(null)
  const [vendors, setVendors] = useState<VendorData[]>([])
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [showCreateExpense, setShowCreateExpense] = useState(false)
  const [showEditExpense, setShowEditExpense] = useState(false)
  const [showVoidDialog, setShowVoidDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showBudgetDialog, setShowBudgetDialog] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseData | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [expenseForm, setExpenseForm] = useState({
    title: "", description: "", amount: "", category: "OTHER",
    vendorName: "", vendorId: "", reference: "", paymentMethod: "",
    expenseDate: "", notes: "",
  })
  const [voidReason, setVoidReason] = useState("")
  const [budgetForm, setBudgetForm] = useState({
    category: "LEGAL", description: "", approvedBudget: "", overBudgetPolicy: "WARN",
  })

  const fetchAll = useCallback(async () => {
    try {
      const [exp, bud, v] = await Promise.all([
        fetch(`/api/circles/${circleId}/projects/${projectId}/expenses`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/circles/${circleId}/projects/${projectId}/budget?dashboard=true`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/circles/${circleId}/projects/${projectId}/vendors`).then((r) => r.ok ? r.json() : []).catch(() => []),
      ])
      if (exp) setExpenseData(exp)
      if (bud) setBudgetData(bud)
      if (v) setVendors(Array.isArray(v) ? v : [])
    } finally {
      setLoading(false)
    }
  }, [circleId, projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function createExpense() {
    if (!expenseForm.title || !expenseForm.amount) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...expenseForm,
          amount: Number(expenseForm.amount),
          expenseDate: expenseForm.expenseDate || undefined,
          vendorId: expenseForm.vendorId || undefined,
        }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense created")
      setShowCreateExpense(false)
      resetExpenseForm()
      fetchAll()
    } catch {
      toast.error("Failed to create expense")
    } finally {
      setSubmitting(false)
    }
  }

  async function updateExpense() {
    if (!selectedExpense) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses/${selectedExpense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...expenseForm,
          amount: Number(expenseForm.amount),
          expenseDate: expenseForm.expenseDate || undefined,
        }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense updated")
      setShowEditExpense(false)
      fetchAll()
    } catch {
      toast.error("Failed to update expense")
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteExpense(expenseId: string) {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses/${expenseId}`, { method: "DELETE" })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense deleted")
      fetchAll()
    } catch {
      toast.error("Failed to delete expense")
    }
  }

  async function submitExpense(expenseId: string) {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses/${expenseId}/submit`, { method: "POST" })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense submitted for approval")
      fetchAll()
    } catch {
      toast.error("Failed to submit")
    }
  }

  async function approveExpense(expenseId: string) {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses/${expenseId}/approve`, { method: "POST" })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense approved")
      fetchAll()
    } catch {
      toast.error("Failed to approve")
    }
  }

  async function rejectExpense(expenseId: string) {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses/${expenseId}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected by reviewer" }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense rejected")
      fetchAll()
    } catch {
      toast.error("Failed to reject")
    }
  }

  async function markPaid(expenseId: string) {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses/${expenseId}/paid`, { method: "POST" })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense marked as paid")
      fetchAll()
    } catch {
      toast.error("Failed to mark as paid")
    }
  }

  async function voidExpenseAction() {
    if (!selectedExpense || !voidReason) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses/${selectedExpense.id}/void`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense voided")
      setShowVoidDialog(false)
      setVoidReason("")
      fetchAll()
    } catch {
      toast.error("Failed to void")
    } finally {
      setSubmitting(false)
    }
  }

  async function duplicateExpense(expenseId: string) {
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/expenses/${expenseId}/duplicate`, { method: "POST" })
      if (!r.ok) throw new Error("Failed")
      toast.success("Expense duplicated")
      fetchAll()
    } catch {
      toast.error("Failed to duplicate")
    }
  }

  async function createBudgetCategory() {
    if (!budgetForm.approvedBudget) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/budget`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...budgetForm,
          approvedBudget: Number(budgetForm.approvedBudget),
        }),
      })
      if (!r.ok) throw new Error("Failed")
      toast.success("Budget category created")
      setShowBudgetDialog(false)
      setBudgetForm({ category: "LEGAL", description: "", approvedBudget: "", overBudgetPolicy: "WARN" })
      fetchAll()
    } catch {
      toast.error("Failed to create budget category")
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(expense: ExpenseData) {
    setSelectedExpense(expense)
    setExpenseForm({
      title: expense.title,
      description: expense.description || "",
      amount: String(Number(expense.amount)),
      category: expense.category,
      vendorName: expense.vendorName || "",
      vendorId: expense.vendorId || "",
      reference: expense.reference || "",
      paymentMethod: expense.paymentMethod || "",
      expenseDate: expense.expenseDate ? expense.expenseDate.split("T")[0] : "",
      notes: expense.notes || "",
    })
    setShowEditExpense(true)
  }

  function resetExpenseForm() {
    setExpenseForm({
      title: "", description: "", amount: "", category: "OTHER",
      vendorName: "", vendorId: "", reference: "", paymentMethod: "",
      expenseDate: "", notes: "",
    })
  }

  const filteredExpenses = (expenseData?.expenses || []).filter((e) => {
    if (filterCategory !== "all" && e.category !== filterCategory) return false
    if (filterStatus !== "all" && e.status !== filterStatus) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!e.title.toLowerCase().includes(q) && !(e.vendorName || "").toLowerCase().includes(q)) return false
    }
    return true
  })

  if (loading) return <ExpensesSkeleton />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-0 -mb-px">
        <button onClick={() => setView("expenses")} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${view === "expenses" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Receipt className="size-3.5 inline mr-1.5" /> Expenses
        </button>
        <button onClick={() => setView("budget")} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${view === "budget" ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <BarChart3 className="size-3.5 inline mr-1.5" /> Budget
        </button>
      </div>

      {view === "expenses" ? (
        <ExpensesView
          data={expenseData}
          vendors={vendors}
          filteredExpenses={filteredExpenses}
          symbol={symbol}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onCreate={() => { resetExpenseForm(); setShowCreateExpense(true) }}
          onEdit={openEdit}
          onDelete={deleteExpense}
          onSubmit={submitExpense}
          onApprove={approveExpense}
          onReject={rejectExpense}
          onMarkPaid={markPaid}
          onVoid={(e) => { setSelectedExpense(e); setShowVoidDialog(true) }}
          onDuplicate={duplicateExpense}
          onViewDetail={(e) => { setSelectedExpense(e); setShowDetailDialog(true) }}
        />
      ) : (
        <BudgetView
          data={budgetData}
          symbol={symbol}
          onCreateCategory={() => setShowBudgetDialog(true)}
        />
      )}

      <ExpenseDialog
        open={showCreateExpense || showEditExpense}
        onOpenChange={(v) => { if (!v) { setShowCreateExpense(false); setShowEditExpense(false) } }}
        title={showEditExpense ? "Edit Expense" : "Create Expense"}
        form={expenseForm}
        setForm={setExpenseForm}
        symbol={symbol}
        vendors={vendors}
        submitting={submitting}
        onSubmit={showEditExpense ? updateExpense : createExpense}
      />

      <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Void Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Voiding expense &quot;{selectedExpense?.title}&quot; for R{Number(selectedExpense?.amount || 0).toLocaleString()}
            </p>
            <div className="space-y-2">
              <Label>Reason for voiding *</Label>
              <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Explain why this expense is being voided..." className="rounded-xl" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVoidDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={voidExpenseAction} disabled={!voidReason || submitting} className="rounded-xl bg-red-600 hover:bg-red-700">
              {submitting ? "Voiding..." : "Void Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetailDrawer
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        expense={selectedExpense}
        symbol={symbol}
      />

      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create Budget Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={budgetForm.category} onValueChange={(v) => setBudgetForm({ ...budgetForm, category: v || "LEGAL" })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={budgetForm.description} onChange={(e) => setBudgetForm({ ...budgetForm, description: e.target.value })} placeholder="Budget for legal expenses" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Approved Budget ({symbol})</Label>
              <Input value={budgetForm.approvedBudget} onChange={(e) => setBudgetForm({ ...budgetForm, approvedBudget: e.target.value })} placeholder="100000" type="number" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Over-Budget Policy</Label>
              <Select value={budgetForm.overBudgetPolicy} onValueChange={(v) => setBudgetForm({ ...budgetForm, overBudgetPolicy: v || "WARN" })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OVER_BUDGET_POLICIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={createBudgetCategory} disabled={!budgetForm.approvedBudget || submitting} className="rounded-xl">
              {submitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ExpensesView({
  data, vendors, filteredExpenses, symbol,
  filterCategory, setFilterCategory, filterStatus, setFilterStatus,
  searchQuery, setSearchQuery,
  onCreate, onEdit, onDelete, onSubmit, onApprove, onReject, onMarkPaid, onVoid, onDuplicate, onViewDetail,
}: {
  data: ExpenseDashboardData | null; vendors: VendorData[]; filteredExpenses: ExpenseData[]; symbol: string
  filterCategory: string; setFilterCategory: (v: string) => void
  filterStatus: string; setFilterStatus: (v: string) => void
  searchQuery: string; setSearchQuery: (v: string) => void
  onCreate: () => void; onEdit: (e: ExpenseData) => void; onDelete: (id: string) => void
  onSubmit: (id: string) => void; onApprove: (id: string) => void; onReject: (id: string) => void
  onMarkPaid: (id: string) => void; onVoid: (e: ExpenseData) => void
  onDuplicate: (id: string) => void; onViewDetail: (e: ExpenseData) => void
}) {
  const summary = data?.summary
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Paid" value={formatCurrency(summary?.totalPaid || 0, symbol)} icon={<DollarSign className="size-4" />} />
        <SummaryCard label="Pending" value={formatCurrency(summary?.totalPending || 0, symbol)} icon={<Clock className="size-4" />} color="text-amber-600" />
        <SummaryCard label="Approved" value={formatCurrency(summary?.totalApproved || 0, symbol)} icon={<CheckCircle2 className="size-4" />} color="text-emerald-600" />
        <SummaryCard label="Remaining" value={formatCurrency(summary?.remainingBudget || 0, symbol)} icon={<Wallet className="size-4" />} />
      </div>

      {data?.warnings && data.warnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
          <AlertTriangle className="size-3.5 inline mr-1" /> {data.warnings[0]}
          {data.warnings.length > 1 && ` (+${data.warnings.length - 1} more)`}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search expenses..." className="pl-8 rounded-xl h-8 text-xs" />
        </div>
        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v || "all")}>
          <SelectTrigger className="w-32 rounded-xl h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c] || c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v || "all")}>
          <SelectTrigger className="w-28 rounded-xl h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="VOIDED">Voided</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="sm" className="rounded-xl" onClick={onCreate}>
          <Plus className="size-3 mr-1" /> New Expense
        </Button>
      </div>

      {filteredExpenses.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-center">
            <Receipt className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No expenses recorded</p>
            <Button size="sm" className="rounded-xl mt-3" onClick={onCreate}>
              <Plus className="size-3 mr-1" /> Record Expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense) => (
            <Card key={expense.id} className="rounded-2xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${EXPENSE_CATEGORY_COLORS[expense.category] || "bg-gray-100 text-gray-700"}`}>
                      <Receipt className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">{expense.title}</p>
                        <Badge variant="outline" className={`text-[10px] ${EXPENSE_STATUS_COLORS[expense.status] || ""}`}>{expense.status}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}</Badge>
                        {expense.vendorName && <span className="text-[10px] text-muted-foreground">{expense.vendorName}</span>}
                        <span className="text-[10px] text-muted-foreground">{formatDate(expense.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(Number(expense.amount), symbol)}</p>
                    <ExpenseActions
                      expense={expense}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onSubmit={onSubmit}
                      onApprove={onApprove}
                      onReject={onReject}
                      onMarkPaid={onMarkPaid}
                      onVoid={onVoid}
                      onDuplicate={onDuplicate}
                      onViewDetail={onViewDetail}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ExpenseActions({
  expense, onEdit, onDelete, onSubmit, onApprove, onReject, onMarkPaid, onVoid, onDuplicate, onViewDetail,
}: {
  expense: ExpenseData
  onEdit: (e: ExpenseData) => void; onDelete: (id: string) => void
  onSubmit: (id: string) => void; onApprove: (id: string) => void
  onReject: (id: string) => void; onMarkPaid: (id: string) => void
  onVoid: (e: ExpenseData) => void; onDuplicate: (id: string) => void
  onViewDetail: (e: ExpenseData) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" className="rounded-lg" />}>
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onViewDetail(expense)}>
          <Eye className="size-3.5 mr-2" /> View Details
        </DropdownMenuItem>
        {expense.status === "DRAFT" && (
          <>
            <DropdownMenuItem onClick={() => onEdit(expense)}>
              <Edit className="size-3.5 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSubmit(expense.id)}>
              <Send className="size-3.5 mr-2" /> Submit for Approval
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(expense.id)}>
              <Trash2 className="size-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </>
        )}
        {expense.status === "REJECTED" && (
          <DropdownMenuItem onClick={() => onEdit(expense)}>
            <Edit className="size-3.5 mr-2" /> Edit & Resubmit
          </DropdownMenuItem>
        )}
        {expense.status === "PENDING" && (
          <>
            <DropdownMenuItem onClick={() => onApprove(expense.id)} className="text-emerald-600">
              <CheckCircle2 className="size-3.5 mr-2" /> Approve
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReject(expense.id)} className="text-red-600">
              <XCircle className="size-3.5 mr-2" /> Reject
            </DropdownMenuItem>
          </>
        )}
        {expense.status === "APPROVED" && (
          <DropdownMenuItem onClick={() => onMarkPaid(expense.id)} className="text-blue-600">
            <DollarSign className="size-3.5 mr-2" /> Mark as Paid
          </DropdownMenuItem>
        )}
        {(expense.status === "APPROVED" || expense.status === "PAID") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onVoid(expense)} className="text-red-600">
              <XCircle className="size-3.5 mr-2" /> Void
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDuplicate(expense.id)}>
          <Copy className="size-3.5 mr-2" /> Duplicate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BudgetView({
  data, symbol, onCreateCategory,
}: {
  data: BudgetDashboardData | null; symbol: string; onCreateCategory: () => void
}) {
  const summary = data?.summary
  const categories = data?.categories || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <SummaryCard label="Approved Budget" value={formatCurrency(summary?.totalApprovedBudget || 0, symbol)} icon={<Wallet className="size-4" />} />
        <SummaryCard label="Spent" value={formatCurrency(summary?.totalSpent || 0, symbol)} icon={<TrendingDown className="size-4" />} color="text-red-500" />
        <SummaryCard label="Remaining" value={formatCurrency(summary?.totalRemaining || 0, symbol)} icon={<TrendingUp className="size-4" />} color="text-emerald-600" />
        <SummaryCard label="Burn %" value={`${summary?.burnPercent || 0}%`} icon={<BarChart3 className="size-4" />} />
        {summary && summary.overBudgetCount > 0 && (
          <SummaryCard label="Over Budget" value={String(summary.overBudgetCount)} icon={<AlertTriangle className="size-4" />} color="text-red-600" />
        )}
        {summary && summary.pendingApprovalCount > 0 && (
          <SummaryCard label="Pending" value={String(summary.pendingApprovalCount)} icon={<Clock className="size-4" />} color="text-amber-600" />
        )}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Budget Categories</h3>
        <Button size="sm" className="rounded-xl" onClick={onCreateCategory}>
          <Plus className="size-3 mr-1" /> Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-center">
            <BarChart3 className="size-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No budget categories configured</p>
            <Button size="sm" className="rounded-xl mt-3" onClick={onCreateCategory}>
              <Plus className="size-3 mr-1" /> Add Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => {
            const approved = Number(cat.approvedBudget)
            const spent = Number(cat.actualCost)
            const committed = Number(cat.committedCost)
            const percent = approved > 0 ? Math.round((spent / approved) * 100) : 0
            return (
              <Card key={cat.id} className="rounded-2xl">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">{EXPENSE_CATEGORY_LABELS[cat.category] || cat.category}</p>
                        <Badge variant="outline" className={`text-[10px] ${BUDGET_STATUS_COLORS[cat.status] || ""}`}>{cat.status?.replace(/_/g, " ")}</Badge>
                      </div>
                      {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px]">{cat.overBudgetPolicy}</Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Spent: {formatCurrency(spent, symbol)}</span>
                    <span>Budget: {formatCurrency(approved, symbol)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${percent > 100 ? "bg-red-500" : percent > 90 ? "bg-amber-500" : "bg-brand"}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{percent}% used</span>
                    <span>Remaining: {formatCurrency(Math.max(0, approved - spent - committed), symbol)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExpenseDialog({
  open, onOpenChange, title, form, setForm, symbol, vendors, submitting, onSubmit,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string
  form: any; setForm: (f: any) => void; symbol: string; vendors: VendorData[]
  submitting: boolean; onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Legal fees" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="rounded-xl" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount ({symbol}) *</Label>
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="50000" type="number" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v || "OTHER" })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} placeholder="Vendor name" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v || "" })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="EFT">EFT</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="INV-001" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Expense Date</Label>
              <Input value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} type="date" className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." className="rounded-xl" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button onClick={onSubmit} disabled={!form.title || !form.amount || submitting} className="rounded-xl">
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailDrawer({
  open, onOpenChange, expense, symbol,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; expense: ExpenseData | null; symbol: string
}) {
  if (!expense) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {expense.title}
            <Badge variant="outline" className={`text-[10px] ${EXPENSE_STATUS_COLORS[expense.status] || ""}`}>{expense.status}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground">Amount</p>
              <p className="font-bold text-lg">{formatCurrency(Number(expense.amount), symbol)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Category</p>
              <Badge variant="outline" className={`text-xs mt-1 ${EXPENSE_CATEGORY_COLORS[expense.category] || ""}`}>
                {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
              </Badge>
            </div>
          </div>

          {expense.description && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">Description</p>
              <p className="text-sm">{expense.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            {expense.vendorName && (
              <div>
                <p className="text-muted-foreground">Vendor</p>
                <p>{expense.vendorName}</p>
              </div>
            )}
            {expense.paymentMethod && (
              <div>
                <p className="text-muted-foreground">Payment Method</p>
                <p>{expense.paymentMethod.replace(/_/g, " ")}</p>
              </div>
            )}
            {expense.reference && (
              <div>
                <p className="text-muted-foreground">Reference</p>
                <p>{expense.reference}</p>
              </div>
            )}
            {expense.expenseDate && (
              <div>
                <p className="text-muted-foreground">Expense Date</p>
                <p>{formatDate(expense.expenseDate)}</p>
              </div>
            )}
          </div>

          <div className="border-t pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created by</span>
              <span>{expense.createdBy?.name || expense.createdBy?.email || "Unknown"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created at</span>
              <span>{formatDate(expense.createdAt)}</span>
            </div>
            {expense.approvedBy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved by</span>
                <span>{expense.approvedBy.name || "Unknown"}</span>
              </div>
            )}
            {expense.approvedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved at</span>
                <span>{formatDate(expense.approvedAt)}</span>
              </div>
            )}
            {expense.voidReason && (
              <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                <p className="text-red-700 font-medium">Void Reason</p>
                <p className="text-red-600">{expense.voidReason}</p>
              </div>
            )}
            {expense.notes && (
              <div>
                <p className="text-muted-foreground">Notes</p>
                <p>{expense.notes}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon?: React.ReactNode; color?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-1">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
        <p className={`text-base sm:text-lg font-bold ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function ExpensesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-5 w-24" /></CardContent></Card>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="rounded-2xl"><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-xl" /></CardContent></Card>
      ))}
    </div>
  )
}
