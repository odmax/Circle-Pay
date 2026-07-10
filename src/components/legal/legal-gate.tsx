"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

const ALLOWED_PATHS = ["/legal", "/login", "/register", "/api/auth", "/api/legal"]

export function LegalGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  const isAllowed = ALLOWED_PATHS.some((p) => pathname.startsWith(p))

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") { setChecking(false); return }
    if (isAllowed) { setChecking(false); return }

    fetch("/api/legal/acceptance-status").then((r) => r.json()).then((d) => {
      if (!d.allAccepted) {
        router.push(`/legal/accept?returnTo=${encodeURIComponent(pathname)}`)
      }
      setChecking(false)
    }).catch(() => setChecking(false))
  }, [status, pathname, isAllowed, router])

  if (checking && status === "authenticated" && !isAllowed) {
    return <div className="flex items-center justify-center py-20"><div className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
  }

  return <>{children}</>
}
