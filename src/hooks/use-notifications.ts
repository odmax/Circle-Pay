"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from "react"

interface NotifData {
  notifications: any[]
  unreadCount: number
}

let sharedCache: { data: NotifData | null; timestamp: number } = { data: null, timestamp: 0 }
let pendingFetch: Promise<NotifData> | null = null
const CACHE_TTL = 30000
const listeners = new Set<() => void>()

function notifyListeners() { listeners.forEach((fn) => fn()) }

export function useNotifications() {
  const [data, setData] = useState<NotifData>(sharedCache.data || { notifications: [], unreadCount: 0 })
  const [loading, setLoading] = useState(!sharedCache.data)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (pendingFetch) return pendingFetch
    pendingFetch = fetch("/api/notifications").then((r) => r.json()).then((json) => {
      const result: NotifData = { notifications: json.notifications || json, unreadCount: json.unreadCount ?? 0 }
      sharedCache = { data: result, timestamp: Date.now() }
      pendingFetch = null
      notifyListeners()
      return result
    }).catch(() => {
      pendingFetch = null
      return sharedCache.data || { notifications: [], unreadCount: 0 }
    })
    return pendingFetch
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (Date.now() - sharedCache.timestamp > CACHE_TTL) {
      fetchData().then((d) => { if (mountedRef.current) { setData(d); setLoading(false) } })
    }
    const listener = () => {
      if (mountedRef.current) { setData(sharedCache.data!); setLoading(false) }
    }
    listeners.add(listener)
    return () => { mountedRef.current = false; listeners.delete(listener) }
  }, [fetchData])

  const refetch = useCallback(async () => {
    sharedCache.timestamp = 0
    setLoading(true)
    const d = await fetchData()
    setData(d)
    setLoading(false)
  }, [fetchData])

  const optimisticMarkRead = useCallback((id: string) => {
    sharedCache.data = sharedCache.data ? {
      notifications: sharedCache.data.notifications.map((n: any) => n.id === id ? { ...n, isRead: true } : n),
      unreadCount: Math.max(0, sharedCache.data.unreadCount - 1),
    } : null
    notifyListeners()
    fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {})
  }, [])

  const optimisticMarkAllRead = useCallback(() => {
    sharedCache.data = sharedCache.data ? {
      notifications: sharedCache.data.notifications.map((n: any) => ({ ...n, isRead: true })),
      unreadCount: 0,
    } : null
    notifyListeners()
    fetch("/api/notifications/mark-all-read", { method: "POST" }).catch(() => {})
  }, [])

  return { ...data, loading, refetch, optimisticMarkRead, optimisticMarkAllRead }
}
