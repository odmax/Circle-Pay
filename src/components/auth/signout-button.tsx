"use client"

import { LogOut } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SignoutButtonProps {
  label?: string
  className?: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  iconName?: "log-out"
  compact?: boolean
  /** When true, renders as a plain clickable div (for use inside MenuPrimitive.Item) */
  asMenuItem?: boolean
}

export function SignoutButton({
  label = "Sign Out",
  className,
  variant = "ghost",
  compact = false,
  asMenuItem = false,
}: SignoutButtonProps) {
  const icon = <LogOut className="size-4" />

  if (asMenuItem) {
    return (
      <a
        href="/api/auth/logout"
        tabIndex={0}
        className={cn(
          "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "text-destructive",
          className
        )}
      >
        {icon}
        {label}
      </a>
    )
  }

  return (
    <a
      href="/api/auth/logout"
      className={cn(buttonVariants({ variant }), "justify-start gap-2", className)}
    >
      {icon}
      {!compact && label}
    </a>
  )
}
