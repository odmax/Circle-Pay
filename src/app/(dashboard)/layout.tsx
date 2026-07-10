import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { CommandPalette } from "@/components/layout/command-palette"
import { PageTransition } from "@/components/layout/page-transition"
import { LegalGate } from "@/components/legal/legal-gate"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-brand focus:text-white focus:px-4 focus:py-2 focus:rounded-xl">Skip to content</a>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6"><LegalGate><PageTransition>{children}</PageTransition></LegalGate></main>
      </div>
      <MobileBottomNav />
      <CommandPalette />
    </div>
  )
}
