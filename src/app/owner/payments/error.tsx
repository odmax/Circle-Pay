"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export default function OwnerPaymentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("OWNER_CLIENT_ERROR", { route: "/owner/payments", digest: error?.digest, name: error?.name, message: error?.message, stack: error?.stack })
  }, [error])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
      <Card className="rounded-2xl border-red-200 bg-red-50/10"><CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <AlertTriangle className="size-10 text-red-500" />
        <div><h2 className="text-lg font-semibold">Could not load payments</h2><p className="text-sm text-muted-foreground mt-1">The payment list could not be retrieved.</p>{error?.digest && <p className="text-[10px] text-muted-foreground mt-2 font-mono">Error ID: {error.digest}</p>}</div>
        <div className="flex gap-2">
          <Button onClick={reset} className="rounded-xl bg-brand hover:bg-brand-600">Retry</Button>
          <Button render={<Link href="/owner" />} variant="outline" className="rounded-xl">Back to Overview</Button>
        </div>
      </CardContent></Card>
    </div>
  )
}
