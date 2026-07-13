"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"

interface AdminStatus {
  isAdmin: boolean
  isActive: boolean
  role?: string
  isPrimaryOwner: boolean
}

export function useAdminStatus() {
  const { data: session, status } = useSession()
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (status !== "authenticated") {
      setAdminStatus({ isAdmin: false, isActive: false, isPrimaryOwner: false })
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const r = await fetch("/api/owner/me")
      const d = await r.json()
      setAdminStatus({
        isAdmin: !!d.isAdmin,
        isActive: !!d.isActive,
        role: d.role || undefined,
        isPrimaryOwner: !!d.isPrimaryOwner,
      })
    } catch {
      setAdminStatus({ isAdmin: false, isActive: false, isPrimaryOwner: false })
    }
    setIsLoading(false)
  }, [status])

  useEffect(() => { refresh() }, [refresh])

  return { ...adminStatus, isLoading, refresh }
}
