"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-red-50">
        <AlertTriangle className="size-8 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">An unexpected error occurred. Please try again.</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset} className="rounded-xl bg-brand hover:bg-brand-600"><RefreshCw className="size-4 mr-1" /> Try Again</Button>
        <Button onClick={() => window.location.href = "/support"} variant="outline" className="rounded-xl">Get Help</Button>
      </div>
    </div>
  )
}
