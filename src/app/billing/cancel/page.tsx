import Link from "next/link"
import { X, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function BillingCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <X className="size-8" />
          </div>
          <h1 className="text-2xl font-bold">Payment Cancelled</h1>
          <p className="mt-2 text-muted-foreground">
            Your payment was not completed. You can try again anytime.
          </p>
          <Button render={<Link href="/upgrade" />} className="mt-6 rounded-xl bg-brand hover:bg-brand-600">
            Try Again <ArrowRight className="ml-2 size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
