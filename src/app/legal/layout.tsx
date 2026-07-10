import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { CommandPalette } from "@/components/layout/command-palette"

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto"><div className="mx-auto max-w-4xl p-4 pb-20 lg:p-8 lg:pb-8">{children}</div></main>
      </div>
      <MobileBottomNav />
      <CommandPalette />
    </div>
  )
}
