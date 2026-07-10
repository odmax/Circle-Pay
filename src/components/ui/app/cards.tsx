"use client"

import { useReducedMotion, motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

function useCardMotion() {
  const reduced = useReducedMotion()
  if (reduced) return {}
  return { whileHover: { y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }, whileTap: { scale: 0.99 }, transition: { duration: 0.15 } }
}

export function StatCard({ label, value, sub, icon: Icon, trend }: { label: string; value: string | number; sub?: string; icon?: React.ComponentType<{ className?: string }>; trend?: "up" | "down" | "neutral" }) {
  const color = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : ""
  const motionProps = useCardMotion()
  return (
    <motion.div {...motionProps}>
      <Card className="rounded-2xl"><CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
        </div>
      </CardContent></Card>
    </motion.div>
  )
}

export function MetricCard({ label, value, icon: Icon, className }: { label: string; value: string | number; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  const motionProps = useCardMotion()
  return (
    <motion.div {...motionProps}>
      <Card className="rounded-2xl"><CardContent className="p-3 text-center">
        {Icon && <Icon className="size-4 mx-auto mb-1 text-muted-foreground" aria-hidden="true" />}
        <div className={`text-xl font-bold ${className || ""}`}>{value}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent></Card>
    </motion.div>
  )
}
