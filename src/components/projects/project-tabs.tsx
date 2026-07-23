"use client"

import { useRef, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: string | number
  hidden?: boolean
}

interface ProjectTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tab: string) => void
}

export function ProjectTabs({ tabs, activeTab, onTabChange }: ProjectTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const activeRef = useRef<HTMLButtonElement>(null)

  const visibleTabs = tabs.filter((t) => !t.hidden)

  const updateScrollState = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (el) {
      el.addEventListener("scroll", updateScrollState, { passive: true })
      window.addEventListener("resize", updateScrollState)
      return () => {
        el.removeEventListener("scroll", updateScrollState)
        window.removeEventListener("resize", updateScrollState)
      }
    }
  }, [])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [activeTab])

  return (
    <div className="relative">
      {/* Scroll arrows for tablet */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center bg-gradient-to-r from-background via-background/80 to-transparent w-10 pointer-events-none sm:pointer-events-auto">
          <Button variant="ghost" size="icon-xs" className="rounded-full pointer-events-auto" onClick={() => scrollRef.current?.scrollBy({ left: -120, behavior: "smooth" })}>
            <ChevronLeft className="size-3" />
          </Button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex gap-0.5 overflow-x-auto scrollbar-none border-b pb-0 -mb-px"
        style={{ scrollBehavior: "smooth" }}
      >
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            ref={activeTab === t.id ? activeRef : undefined}
            onClick={() => onTabChange(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px shrink-0 ${
              activeTab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge !== null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === t.id ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center bg-gradient-to-l from-background via-background/80 to-transparent w-10 pointer-events-none sm:pointer-events-auto">
          <Button variant="ghost" size="icon-xs" className="rounded-full pointer-events-auto ml-auto" onClick={() => scrollRef.current?.scrollBy({ left: 120, behavior: "smooth" })}>
            <ChevronRight className="size-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
