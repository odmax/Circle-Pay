"use client"

import { Loader2, AlertTriangle, FolderOpen, FileX } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ProjectLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Loading project...</p>
    </div>
  )
}

export function ProjectError({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertTriangle className="size-8 text-amber-500" />
      <p className="text-sm font-medium">{message || "Something went wrong"}</p>
      <p className="text-xs text-muted-foreground">Failed to load project data</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="rounded-xl mt-1" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  )
}

export function ProjectEmpty({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Icon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <FileX className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Project not found</p>
      <p className="text-xs text-muted-foreground">
        This project may have been deleted or you don&apos;t have access.
      </p>
    </div>
  )
}

export function TabSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
      ))}
    </div>
  )
}
