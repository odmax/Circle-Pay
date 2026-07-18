"use client"

import { Loader2 } from "lucide-react"

export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}

export function ErrorState({ title, description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium text-red-600">{title || "Something went wrong"}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
