"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Globe, ArrowRight } from "lucide-react"
import { Input } from "@/components/ui/input"

type CircleItem = { id: string; name: string; type: string }

export function CircleSwitcher({ currentId }: { currentId?: string }) {
  const [circles, setCircles] = useState<CircleItem[]>([])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const router = useRouter()

  useEffect(() => {
    fetch("/api/circles").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCircles(d) }).catch(() => {})
  }, [])

  const filtered = q ? circles.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : circles

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "j") { e.preventDefault(); setOpen((v) => !v) }
      if (e.key === "Escape" && open) { setOpen(false) }
    }
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey)
  }, [])

  if (circles.length === 0) return null

  const current = circles.find((c) => c.id === currentId)

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
        <Globe className="size-4 shrink-0" />
        <span className="truncate flex-1 text-left">{current?.name || "Switch Circle"}</span>
        <kbd className="ml-auto text-[10px] text-sidebar-foreground/30 border border-sidebar-border rounded px-1 hidden lg:inline">Ctrl+J</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
          <div className="bg-card border rounded-2xl shadow-xl w-full max-w-md p-4 space-y-3 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search circles..." className="rounded-xl pl-9" autoFocus /></div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filtered.slice(0, 15).map((c) => (
                <button key={c.id} onClick={() => { router.push(`/circles/${c.id}`); setOpen(false) }} className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${c.id === currentId ? "bg-brand-50 text-brand-800" : ""}`}>
                  <div className="flex size-7 items-center justify-center rounded-md bg-brand-50 text-brand text-[10px] font-bold">{c.name[0]}</div>
                  <div className="flex-1 min-w-0"><p className="font-medium truncate">{c.name}</p><p className="text-[10px] text-muted-foreground capitalize">{c.type.toLowerCase().replace(/_/g, " ")}</p></div>
                  <ArrowRight className="size-3 text-muted-foreground/30" />
                </button>
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No circles found</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
