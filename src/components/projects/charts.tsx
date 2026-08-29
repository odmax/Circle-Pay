"use client"

import { useId } from "react"

const CHART_COLORS = {
  revenue: "#16a34a",
  expense: "#ef4444",
  roi: "#7c3aed",
  brand: "#16a34a",
}

export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className={`h-2 rounded-full bg-muted overflow-hidden ${className}`}>
      <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${p}%` }} />
    </div>
  )
}

export interface DonutSegment {
  label: string
  value: number
  color: string
}

export function DonutChart({
  segments,
  size = 130,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  let offset = 0

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-muted" opacity={0.15} />
          {total > 0 &&
            segments.filter((s) => s.value > 0).map((seg, i) => {
              const len = (seg.value / total) * circumference
              const dash = `${len} ${circumference - len}`
              const dashOffset = -offset
              offset += len
              return (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={dashOffset}
                />
              )
            })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue && <span className="text-sm font-bold leading-none">{centerValue}</span>}
            {centerLabel && <span className="text-[10px] text-muted-foreground mt-1">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="space-y-1.5 flex-1 min-w-[140px]">
        {segments.length === 0 && <p className="text-sm text-muted-foreground">No data yet</p>}
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-medium shrink-0">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GroupedBarChart({
  data,
  aLabel,
  bLabel,
  aColor = CHART_COLORS.revenue,
  bColor = CHART_COLORS.expense,
  height = 170,
}: {
  data: Array<{ label: string; a: number; b: number }>
  aLabel: string
  bLabel: string
  aColor?: string
  bColor?: string
  height?: number
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b)))
  const w = 320
  const h = height
  const padTop = 12
  const padBottom = 22
  const groupW = (w - 16) / Math.max(1, data.length)
  const barW = Math.min(10, (groupW - 6) / 2)

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padTop + (h - padTop - padBottom) * (1 - tick)
          return <line key={tick} x1={8} y1={y} x2={w - 8} y2={y} stroke="currentColor" strokeWidth={1} className="text-muted" opacity={0.2} />
        })}
        {data.map((d, i) => {
          const gx = 8 + i * groupW
          const aH = Math.max(0, (d.a / max) * (h - padTop - padBottom))
          const bH = Math.max(0, (d.b / max) * (h - padTop - padBottom))
          const startX = gx + (groupW - barW * 2) / 2
          return (
            <g key={i}>
              {aH > 0 && <rect x={startX} y={h - padBottom - aH} width={barW} height={aH} fill={aColor} rx={2} />}
              {bH > 0 && <rect x={startX + barW} y={h - padBottom - bH} width={barW} height={bH} fill={bColor} rx={2} />}
              <text x={gx + groupW / 2} y={h - 7} textAnchor="middle" fontSize="9" className="fill-muted-foreground">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: aColor }} /> {aLabel}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: bColor }} /> {bLabel}</span>
      </div>
    </div>
  )
}

export function AreaLineChart({
  data,
  color = CHART_COLORS.roi,
  height = 170,
  signLabels = false,
}: {
  data: Array<{ label: string; value: number }>
  color?: string
  height?: number
  signLabels?: boolean
}) {
  const id = useId().replace(/:/g, "")
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No data yet</p>
  }
  const w = 320
  const h = height
  const pad = 10
  const values = data.map((d) => d.value)
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const range = max - min || 1
  const pts = data.map((d, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1)
    const y = h - pad - ((d.value - min) / range) * (h - pad * 2)
    return { x, y }
  })
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ")
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`
  const last = pts[pts.length - 1]

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((tick) => {
          const y = pad + (h - pad * 2) * (1 - tick)
          return <line key={tick} x1={pad} y1={y} x2={w - pad} y2={y} stroke="currentColor" strokeWidth={1} className="text-muted" opacity={0.18} />
        })}
        <polygon points={area} fill={`url(#grad-${id})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {last && <circle cx={last.x} cy={last.y} r={3.5} fill={color} />}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        {signLabels ? data.map((d, i) => <span key={i}>{d.label}</span>) : <span>{data[0]?.label}</span>}
        {!signLabels && <span>{data[data.length - 1]?.label}</span>}
      </div>
    </div>
  )
}

export { CHART_COLORS }