"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LegalDoc({ title, updated, sections, children }: { title: string; updated: string; sections: { id: string; label: string }[]; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Button render={<Link href="/legal" />} variant="outline" size="icon" className="rounded-xl"><ArrowLeft className="size-4" /></Button>
        <div><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="text-sm text-muted-foreground mt-1">Last updated: {updated}</p></div>
      </div>
      <div className="flex gap-8">
        <nav className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1">{s.label}</a>
            ))}
          </div>
        </nav>
        <div className="flex-1 min-w-0 max-w-none lg:max-w-3xl">
          <div className="prose prose-sm prose-neutral max-w-none space-y-6 [&_p]:leading-relaxed [&_h3]:text-lg [&_h3]:font-semibold [&_section]:scroll-mt-24">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
