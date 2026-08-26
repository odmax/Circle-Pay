import { redirect } from "next/navigation"
import { Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import { getUserReceipts } from "@/lib/services/receipt.service"
import { UserReceiptsList } from "@/components/receipts/user-receipts-list"

export default async function PersonalReceiptsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  let receipts: Awaited<ReturnType<typeof getUserReceipts>> = []
  try {
    receipts = await getUserReceipts(session.user.id)
  } catch {
    receipts = []
  }

  const totalAmount = receipts.reduce(
    (sum, r) => sum + Number(r.amount ?? 0),
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Receipts</h1>
        <p className="text-muted-foreground">
          Receipts from all your circles
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Total Receipts</p>
          <p className="text-2xl font-bold mt-1">{receipts.length}</p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Active</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">
            {receipts.filter((r) => r.status === "ACTIVE").length}
          </p>
        </div>
        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold mt-1">
            R{totalAmount.toLocaleString()}
          </p>
        </div>
      </div>

      <UserReceiptsList receipts={receipts as never} />
    </div>
  )
}
