import Link from "next/link"
import { Check, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md rounded-2xl border-emerald-200 bg-emerald-50/30">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <Check className="size-8" />
          </div>
          <h1 className="text-2xl font-bold">Payment Successful!</h1>
          <p className="mt-2 text-muted-foreground">
            Your subscription has been activated. Thank you for upgrading!
          </p>
          <Button render={<Link href="/dashboard" />} className="mt-6 rounded-xl bg-brand hover:bg-brand-600">
            Go to Dashboard <ArrowRight className="ml-2 size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
