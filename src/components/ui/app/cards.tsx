"use client"

import { useReducedMotion, motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Users, UserCheck, Globe, Crown, DollarSign, TrendingUp, Sparkles, Wallet, ShieldCheck, AlertTriangle, UserPlus, Heart, Plane, Home, Gem, PiggyBank, Church, Circle, BarChart3, Bell, Target, FileText, MessageSquare, Calendar, Search, ShoppingBag, Megaphone, Gift, Send, Activity, ArrowRight, RefreshCw, ArrowLeft, Check, X, Loader2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download, PlusCircle, MoreHorizontal, Eye, Edit, Trash2, ExternalLink, Link as LinkIcon, Copy, Clock, Zap, Hash, Filter, SlidersHorizontal, Settings, Menu } from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users, "user-check": UserCheck, globe: Globe, crown: Crown,
  "dollar-sign": DollarSign, "trending-up": TrendingUp, sparkles: Sparkles,
  wallet: Wallet, "shield-check": ShieldCheck, "alert-triangle": AlertTriangle,
  "user-plus": UserPlus, heart: Heart, plane: Plane, home: Home, gem: Gem,
  "piggy-bank": PiggyBank, church: Church, circle: Circle, "bar-chart": BarChart3,
  bell: Bell, target: Target, "file-text": FileText, "message-square": MessageSquare,
  calendar: Calendar, search: Search, "shopping-bag": ShoppingBag, megaphone: Megaphone,
  gift: Gift, send: Send, activity: Activity, "arrow-right": ArrowRight,
  "refresh-cw": RefreshCw, "arrow-left": ArrowLeft, check: Check, x: X,
  "loader-2": Loader2, "chevron-left": ChevronLeft, "chevron-right": ChevronRight,
  "arrow-up-down": ArrowUpDown, "arrow-up": ArrowUp, "arrow-down": ArrowDown,
  download: Download, "plus-circle": PlusCircle, "more-horizontal": MoreHorizontal,
  eye: Eye, edit: Edit, trash: Trash2, "external-link": ExternalLink, link: LinkIcon,
  copy: Copy, clock: Clock, zap: Zap, hash: Hash, filter: Filter,
  sliders: SlidersHorizontal, settings: Settings, menu: Menu,
}

function useCardMotion() {
  const reduced = useReducedMotion()
  if (reduced) return {}
  return { whileHover: { y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }, whileTap: { scale: 0.99 }, transition: { duration: 0.15 } }
}

export function StatCard({ label, value, sub, iconName, trend }: { label: string; value: string | number; sub?: string; iconName?: string; trend?: "up" | "down" | "neutral" }) {
  const Icon = iconName ? iconMap[iconName] : undefined
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

export function MetricCard({ label, value, iconName, className }: { label: string; value: string | number; iconName?: string; className?: string }) {
  const Icon = iconName ? iconMap[iconName] : undefined
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
