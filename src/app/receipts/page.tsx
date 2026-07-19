import { redirect } from "next/navigation"
import { Receipt } from "lucide-react"
import { auth } from "@/lib/auth"
import { getUserReceipts } from "@/lib/services/receipt.service"
import { UserReceiptsList } from "@/components/receipts/user-receipts-list"
import { CURRENCIES } from "@/lib/constants"

export default async function PersonalReceiptsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const receipts = await getUserReceipts(session.user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Receipts</h1>
        <p className="text-muted-foreground">
          Receipts from all your circles
        </p>
      </div>

      <UserReceiptsList receipts={receipts as never} />
    </div>
  )
}
