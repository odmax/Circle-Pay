"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet"
import { ownerNavGroups } from "@/lib/navigation/owner-navigation"
import { useSidebar } from "./sidebar-provider"

export function OwnerMenuButton() {
  const { setOpen } = useSidebar()
  return (
    <Button
      variant="outline"
      size="icon"
      className="shrink-0 lg:hidden"
      aria-label="Toggle owner navigation"
      onClick={() => setOpen(true)}
    >
      <Menu className="size-5" />
    </Button>
  )
}

export function OwnerMobileSheet() {
  const { open, setOpen } = useSidebar()
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || (href !== "/owner" && pathname.startsWith(href))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" showCloseButton={false} className="p-0 max-w-sm min-w-[280px]">
        <div className="flex h-full flex-col bg-background text-foreground">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 h-16">
            <div className="flex items-center gap-3">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-white">
                <span className="text-xs font-bold">M</span>
              </div>
              <span className="font-bold tracking-tight">Mozetech Owner</span>
            </div>
            <SheetClose
              className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </SheetClose>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {ownerNavGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 mb-1.5">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SheetClose
                      key={item.href}
                      render={
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                            isActive(item.href)
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        />
                      }
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </SheetClose>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="shrink-0 border-t border-border px-3 py-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
