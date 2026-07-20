"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { LogOut, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    if (loading) return
    setLoading(true)
    try {
      await signOut({ callbackUrl: "/login" })
    } catch {
      setLoading(false)
    }
  }

  const icon = loading ? (
    <Loader2 className="size-4 animate-spin" />
  ) : (
    <LogOut className="size-4" />
  )

  if (asMenuItem) {
    return (
      <div
        onClick={handleSignOut}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSignOut() }}
        role="button"
        tabIndex={0}
        aria-disabled={loading}
        className={cn(
          "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "text-destructive",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className
        )}
      >
        {icon}
        {label}
      </div>
    )
  }

  return (
    <Button
      variant={variant}
      onClick={handleSignOut}
      disabled={loading}
      className={cn(
        "justify-start gap-2",
        className
      )}
    >
      {icon}
      {!compact && label}
    </Button>
  )
}
