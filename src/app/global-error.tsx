"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-red-50">
            <AlertTriangle className="size-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Critical Error</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">The application encountered a critical error. Please try refreshing.</p>
          <Button onClick={reset} className="mt-6 rounded-xl bg-brand hover:bg-brand-600">Refresh Page</Button>
        </div>
      </body>
    </html>
  )
}
