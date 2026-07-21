import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SidebarProvider } from "@/components/layout/sidebar-provider"
import { OwnerMenuButton, OwnerMobileSheet } from "@/components/layout/owner-sidebar"
import { ownerNavGroups } from "@/lib/navigation/owner-navigation"
import { CommandPalette } from "@/components/layout/command-palette"
import { PageTransition } from "@/components/layout/page-transition"

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  let session: any = null
  try {
    session = await auth()
  } catch (err) {
    console.error("OWNER_LAYOUT_AUTH_FAILED", err instanceof Error ? err.message : String(err))
  }
  if (!session?.user?.id) redirect("/login")

  let admin: any = null
  try {
    admin = await prisma.internalAdmin.findUnique({ where: { userId: session.user.id } })
  } catch (err) {
    console.error("OWNER_LAYOUT_ADMIN_QUERY_FAILED", err instanceof Error ? err.message : String(err))
  }
  if (!admin || !admin.isActive) redirect("/owner/login?error=no-access")

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <a href="#owner-main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-amber-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl">Skip to content</a>
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border/40 bg-card lg:flex" role="navigation" aria-label="Owner navigation">
          <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border/40 px-5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500 text-white"><span className="text-xs font-bold">M</span></div>
            <span className="font-bold tracking-tight">Mozetech Owner</span>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
            {ownerNavGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((l) => (
                    <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <l.icon className="size-4" />
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-border/40 bg-background/95 backdrop-blur px-4 lg:px-6">
            <OwnerMenuButton />
            <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="size-4" /> Back to Dashboard</Link>
            <div className="flex-1" />
            <span className="text-sm font-medium text-muted-foreground">Owner Dashboard</span>
          </header>
          <main id="owner-main" className="flex-1 overflow-y-auto p-4 lg:p-8"><PageTransition>{children}</PageTransition></main>
        </div>
        <OwnerMobileSheet />
        <CommandPalette />
      </div>
    </SidebarProvider>
  )
}
