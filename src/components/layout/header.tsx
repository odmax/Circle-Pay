"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { useSidebar } from "./sidebar-provider"

export function Header() {
  const { setOpen } = useSidebar()

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/40 bg-background/95 backdrop-blur px-4 lg:px-6">
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 lg:hidden"
        aria-label="Toggle navigation"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex-1" />

      <NotificationBell />
    </header>
  )
}
