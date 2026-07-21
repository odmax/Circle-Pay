"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { MobileSidebar } from "./mobile-sidebar"
import { NotificationBell } from "@/components/notifications/notification-bell"

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/40 bg-background/95 backdrop-blur px-4 lg:px-6">
      {/* Mobile menu trigger */}
      <Sheet>
        <SheetTrigger render={<Button variant="outline" size="icon" className="shrink-0 lg:hidden" aria-label="Toggle navigation" />}>
          <Menu className="size-5" />
          <span className="sr-only">Toggle navigation</span>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 max-w-sm min-w-[280px]">
          <MobileSidebar />
        </SheetContent>
      </Sheet>

      {/* Breadcrumb / page title area */}
      <div className="flex-1" />

      {/* Notification Bell */}
      <NotificationBell />
    </header>
  )
}
