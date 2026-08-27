"use client"

import { AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface Alert {
  type: string
  title: string
  message: string
  severity: "info" | "warning" | "error"
}

interface StokvelAlertsProps {
  alerts: Alert[]
}

const SEVERITY_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; border: string; bg: string; text: string }> = {
  info: { icon: Info, border: "border-blue-200", bg: "bg-blue-50/20", text: "text-blue-800" },
  warning: { icon: AlertTriangle, border: "border-amber-200", bg: "bg-amber-50/20", text: "text-amber-800" },
  error: { icon: AlertTriangle, border: "border-red-200", bg: "bg-red-50/20", text: "text-red-800" },
}

export function StokvelAlerts({ alerts }: StokvelAlertsProps) {
  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info
        const Icon = cfg.icon
        return (
          <div
            key={alert.type}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3",
              cfg.border,
              cfg.bg
            )}
          >
            <Icon className={`size-4 shrink-0 mt-0.5 ${alert.severity === "error" ? "text-red-600" : alert.severity === "warning" ? "text-amber-600" : "text-blue-600"}`} />
            <div>
              <p className={`text-sm font-medium ${cfg.text}`}>{alert.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
