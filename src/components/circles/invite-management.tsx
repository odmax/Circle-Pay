"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Share2, Download, RefreshCw, Power, PowerOff, Clock, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface Props {
  circleId: string
  inviteCode: string
  inviteCodeEnabled: boolean
  inviteCodeExpiresAt: string | null
  circleName: string
  isAdmin: boolean
}

export function InviteManagement({ circleId, inviteCode, inviteCodeEnabled, inviteCodeExpiresAt, circleName, isAdmin }: Props) {
  const [code, setCode] = useState(inviteCode)
  const [enabled, setEnabled] = useState(inviteCodeEnabled)
  const [expiresAt, setExpiresAt] = useState(inviteCodeExpiresAt)
  const [loading, setLoading] = useState(false)
  const inviteLink = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${code}`
  const isExpired = expiresAt && new Date(expiresAt) < new Date()

  async function action(act: string, payload?: Record<string, unknown>) {
    setLoading(true)
    try {
      if (act === "copy") { navigator.clipboard.writeText(code); toast.success("Code copied"); setLoading(false); return }
      if (act === "copy-link") { navigator.clipboard.writeText(inviteLink); toast.success("Link copied"); setLoading(false); return }
      if (act === "share") {
        if (navigator.share) await navigator.share({ title: `Join ${circleName}`, text: `Join my circle "${circleName}" on Circle Pay: ${inviteLink}`, url: inviteLink })
        else { navigator.clipboard.writeText(inviteLink); toast.success("Link copied (share not supported)") }
        setLoading(false); return
      }
      const body = payload ? { action: act, ...payload } : { action: act }
      const r = await fetch(`/api/circles/${circleId}/invite-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed") }
      else if (act === "regenerate") { setCode(d.inviteCode); setEnabled(true); setExpiresAt(null); toast.success("Code regenerated") }
      else if (act === "disable") { setEnabled(false); toast.success("Code disabled") }
      else if (act === "enable") { setEnabled(true); toast.success("Code enabled") }
      else if (act === "set-expiry") { setExpiresAt(payload?.expiresAt as string || null); toast.success("Expiry updated") }
    } catch { toast.error("Failed") }
    setLoading(false)
  }

  async function downloadQR() {
    const svg = document.querySelector(".invite-qr svg") as SVGElement
    if (!svg) return
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()
    img.onload = () => { canvas.width = img.width; canvas.height = img.height; ctx?.drawImage(img, 0, 0); const a = document.createElement("a"); a.download = `circlepay-invite-${code}.png`; a.href = canvas.toDataURL("image/png"); a.click() }
    img.src = "data:image/svg+xml;base64," + btoa(new XMLSerializer().serializeToString(svg))
  }

  const expiryOptions = [{ label: "Never", value: null }, { label: "24h", value: new Date(Date.now() + 86400000).toISOString() }, { label: "7 days", value: new Date(Date.now() + 7 * 86400000).toISOString() }, { label: "30 days", value: new Date(Date.now() + 30 * 86400000).toISOString() }] as const
  const daysLeft = expiresAt && !isExpired ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : 0

  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Link className="size-4" /> Invite Code</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <code className="text-xl font-mono font-bold tracking-wider">{code}</code>
          <Badge variant="outline" className={!enabled ? "border-red-200 bg-red-50 text-red-700 text-[10px]" : isExpired ? "border-amber-200 bg-amber-50 text-amber-700 text-[10px]" : "border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]"}>
            {!enabled ? "Disabled" : isExpired ? "Expired" : daysLeft > 0 ? `Expires in ${daysLeft}d` : "Active"}
          </Badge>
        </div>

        <div className="flex justify-center">
          <div className="invite-qr rounded-2xl border p-4 bg-white"><QRCodeSVG value={inviteLink} size={160} level="M" /></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => action("copy")}><Copy className="size-3.5 mr-1" /> Copy Code</Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => action("copy-link")}><Link className="size-3.5 mr-1" /> Copy Link</Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => action("share")}><Share2 className="size-3.5 mr-1" /> Share</Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={downloadQR}><Download className="size-3.5 mr-1" /> QR</Button>
        </div>

        {expiresAt && <p className="text-xs text-muted-foreground text-center">{isExpired ? "Expired on" : "Expires"} {new Date(expiresAt).toLocaleDateString()}</p>}

        {isAdmin && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={() => action("regenerate")}><RefreshCw className="size-3 mr-1" /> New</Button>
              <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={() => action(enabled ? "disable" : "enable")}>
                {enabled ? <PowerOff className="size-3" /> : <Power className="size-3" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Expiry:</p>
            <div className="flex flex-wrap gap-1">
              {expiryOptions.map((opt, i) => (
                <Button key={i} variant="ghost" size="sm" className="rounded-lg text-[10px] h-6" onClick={() => action("set-expiry", { expiresAt: opt.value })}>{opt.label}</Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
